/**
 * 统一文档处理模块
 *
 * 将各种文件 URL 转换为 AI 可直接消费的 content blocks：
 * - 文本类（txt/md/json...）：下载内容 → text block
 * - PDF：PyMuPDF 转 PNG（150 DPI）→ 上传 OSS → image_url（带页码标注）
 * - PPT/PPTX：python-pptx 提取文本 → text block（带页码标注）
 * - 图片：image_url
 * - 视频：video_url
 */
import { Injectable, Logger } from "@nestjs/common";
import { spawn } from "child_process";
import axios from "axios";
import path from "path";
import fs from "fs";
import os from "os";
import { uploadBufferToOSS, isOSSConfigured } from "./oss.service";

// ========== 类型 ==========
export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageUrlContent {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "low" | "high" | "auto";
  };
}

export interface VideoUrlContent {
  type: "video_url";
  video_url: {
    url: string;
  };
}

/** 处理后的 content blocks，OpenAI 兼容 */
export type ProcessedContent = TextContent | ImageUrlContent | VideoUrlContent;

@Injectable()
export class DocumentProcessor {
  private readonly logger = new Logger(DocumentProcessor.name);

  /** 下载远程文件到 Buffer */
  async downloadFileToBuffer(url: string): Promise<Buffer> {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000,
      maxContentLength: 50 * 1024 * 1024,
    });
    return Buffer.from(response.data);
  }

  /** PDF 逐页转 PNG（默认 150 DPI） */
  async convertPdfToImages(
    pdfBuffer: Buffer,
    dpi = 150,
  ): Promise<Array<{ pageNumber: number; pngBuffer: Buffer }>> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pdf-convert-"));
    const inputPath = path.join(tempDir, "input.pdf");

    try {
      fs.writeFileSync(inputPath, pdfBuffer);

      const scriptPath = path.join(process.cwd(), "scripts", "pdf-to-images.py");
      const { stdout } = await new Promise<{
        stdout: string;
        stderr: string;
      }>((resolve, reject) => {
        const pythonPath =
          process.platform === "win32" ? "C:/Python314/python.exe" : "/usr/bin/python3";
        const proc = spawn(pythonPath, [
          scriptPath,
          inputPath,
          tempDir,
          "--dpi",
          String(dpi),
        ]);
        let stdout = "";
        let stderr = "";
        proc.stdout.on("data", (d) => {
          stdout += d.toString();
        });
        proc.stderr.on("data", (d) => {
          stderr += d.toString();
        });
        proc.on("close", (code) => {
          if (code !== 0)
            reject(new Error(`pdf-to-images.py 退出码 ${code}: ${stderr}`));
          else resolve({ stdout, stderr });
        });
      });

      const result = JSON.parse(stdout) as {
        pages: Array<{ pageNumber: number; filename: string }>;
        dpi: number;
      };
      if ("error" in result && result.error) {
        throw new Error(String(result.error));
      }

      const pages: Array<{ pageNumber: number; pngBuffer: Buffer }> = [];
      for (const p of result.pages) {
        const pngPath = path.join(tempDir, p.filename);
        const pngBuffer = fs.readFileSync(pngPath);
        pages.push({ pageNumber: p.pageNumber, pngBuffer });
      }
      return pages;
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        /* ignore cleanup errors */
      }
    }
  }

  /** PPTX 提取每页文本 */
  async extractPptxText(
    pptxBuffer: Buffer,
  ): Promise<Array<{ pageNumber: number; text: string }>> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pptx-extract-"));
    const inputPath = path.join(tempDir, "input.pptx");

    try {
      fs.writeFileSync(inputPath, pptxBuffer);

      const scriptPath = path.join(process.cwd(), "scripts", "pptx-to-text.py");
      const { stdout } = await new Promise<{
        stdout: string;
        stderr: string;
      }>((resolve, reject) => {
        const pythonPath =
          process.platform === "win32" ? "C:/Python314/python.exe" : "/usr/bin/python3";
        const proc = spawn(pythonPath, [scriptPath, inputPath]);
        let stdout = "";
        let stderr = "";
        proc.stdout.on("data", (d) => {
          stdout += d.toString();
        });
        proc.stderr.on("data", (d) => {
          stderr += d.toString();
        });
        proc.on("close", (code) => {
          if (code !== 0)
            reject(new Error(`pptx-to-text.py 退出码 ${code}: ${stderr}`));
          else resolve({ stdout, stderr });
        });
      });

      const result = JSON.parse(stdout) as {
        slides: Array<{ pageNumber: number; text: string }>;
      };
      if ("error" in result && result.error) {
        throw new Error(String(result.error));
      }
      return result.slides || [];
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        /* ignore cleanup errors */
      }
    }
  }

  /** 从 URL 提取扩展名（去除查询参数） */
  private getUrlExtension(url: string): string {
    return url.split("?")[0].split(".").pop()?.toLowerCase() || "";
  }

  /** 获取文件名（用于日志展示） */
  private getUrlFileName(url: string): string {
    return url.split("?")[0].split("/").pop() || "unknown";
  }

  /**
   * 统一处理 URL 列表，转换为 AI 可直接消费的 content blocks。
   *
   * 处理规则：
   * - 图片 → image_url
   * - 视频 → video_url
   * - txt/md/json/csv 等纯文本 → 下载后直接作为 text block
   * - pdf → 转 PNG（150 DPI）→ 上传 OSS → image_url 数组（带页码标注）
   * - ppt/pptx → 提取每页文本 → text block 数组（带页码标注）
   * - 其他 → 尝试作为文本下载，失败则报错
   *
   * @throws 当 OSS 未配置或处理失败时
   */
  async processUrlsToContentBlocks(
    urls: string[],
    options?: {
      modelName?: string;
    },
  ): Promise<ProcessedContent[]> {
    this.logger.debug(
      `processUrlsToContentBlocks 开始，urlCount=${urls.length}，modelName=${options?.modelName ?? "默认"}`,
    );

    if (!isOSSConfigured()) {
      throw new Error("处理文档需要配置阿里云 OSS，请在环境变量中配置 OSS 相关参数");
    }

    const blocks: ProcessedContent[] = [];

    for (const url of urls) {
      const ext = this.getUrlExtension(url);
      this.logger.debug(`处理 URL，ext=${ext}，url=${url.slice(0, 100)}`);

      // ---- 图片 ----
      const imageExts = ["png", "jpg", "jpeg", "gif", "webp", "bmp"];
      if (imageExts.includes(ext)) {
        blocks.push({ type: "image_url", image_url: { url } });
        continue;
      }

      // ---- 视频 ----
      const videoExts = ["mp4", "mov", "avi", "mkv", "webm"];
      if (videoExts.includes(ext)) {
        blocks.push({ type: "video_url", video_url: { url } });
        continue;
      }

      // ---- 纯文本 ----
      const textExts = [
        "txt",
        "md",
        "json",
        "csv",
        "js",
        "ts",
        "html",
        "xml",
        "yaml",
        "yml",
      ];
      if (textExts.includes(ext)) {
        try {
          const buffer = await this.downloadFileToBuffer(url);
          const text = buffer.toString("utf-8");
          blocks.push({
            type: "text",
            text: `[文件: ${this.getUrlFileName(url)}]\n${text}\n[/文件]`,
          });
        } catch (err) {
          this.logger.error(`文本下载失败: ${url}`, (err as Error).stack);
          throw new Error(`无法下载文本文件: ${url}`);
        }
        continue;
      }

      // ---- PDF → 图片 ----
      if (ext === "pdf") {
        try {
          const pdfBuffer = await this.downloadFileToBuffer(url);
          const pages = await this.convertPdfToImages(pdfBuffer, 150);
          this.logger.debug(`PDF 转图片完成，pageCount=${pages.length}`);

          const uploadResults = await Promise.all(
            pages.map(async (page) => {
              const filename = `pdf-page-${Date.now()}-${page.pageNumber}.png`;
              const imageUrl = await uploadBufferToOSS(
                page.pngBuffer,
                `uploads/${filename}`,
                "image/png",
              );
              return { pageNumber: page.pageNumber, imageUrl };
            }),
          );

          blocks.push({
            type: "text",
            text: `[PDF 文档: ${this.getUrlFileName(url)}，共 ${pages.length} 页]`,
          });
          for (const r of uploadResults) {
            blocks.push({ type: "text", text: `--- 第 ${r.pageNumber} 页 ---` });
            blocks.push({
              type: "image_url",
              image_url: { url: r.imageUrl },
            });
          }
        } catch (err) {
          this.logger.error(`PDF 处理失败: ${url}`, (err as Error).stack);
          throw new Error(
            `PDF 处理失败: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        continue;
      }

      // ---- PPT/PPTX → 文本 ----
      if (ext === "pptx" || ext === "ppt") {
        try {
          const pptxBuffer = await this.downloadFileToBuffer(url);
          const slides = await this.extractPptxText(pptxBuffer);
          this.logger.debug(`PPTX 文本提取完成，slideCount=${slides.length}`);

          blocks.push({
            type: "text",
            text: `[PPT 文档: ${this.getUrlFileName(url)}，共 ${slides.length} 页]`,
          });
          for (const slide of slides) {
            blocks.push({
              type: "text",
              text: `--- 第 ${slide.pageNumber} 页 ---\n${slide.text || "(无文本内容)"}`,
            });
          }
        } catch (err) {
          this.logger.error(`PPTX 处理失败: ${url}`, (err as Error).stack);
          throw new Error(
            `PPTX 处理失败: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        continue;
      }

      // ---- 其他类型：尝试作为文本下载 ----
      this.logger.debug(`未知类型，尝试文本读取，ext=${ext}`);
      try {
        const buffer = await this.downloadFileToBuffer(url);
        const text = buffer.toString("utf-8");
        blocks.push({
          type: "text",
          text: `[文件: ${this.getUrlFileName(url)}]\n${text}\n[/文件]`,
        });
      } catch (err) {
        this.logger.error(`文件处理失败: ${url}`, (err as Error).stack);
        throw new Error(`不支持的文件类型或处理失败: ${ext || "unknown"} (${url})`);
      }
    }

    this.logger.debug(`processUrlsToContentBlocks 完成，blockCount=${blocks.length}`);
    return blocks;
  }
}
