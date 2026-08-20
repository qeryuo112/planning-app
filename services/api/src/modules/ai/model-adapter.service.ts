import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources";
import { ProcessedContent } from "./document-processor.service";

export interface StructuredResponse<T> {
  data: T | null;
  raw: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
}

export interface ModelConfig {
  provider: string;
  apiKey: string;
  baseURL?: string;
  model: string;
  enabled: boolean;
}

export interface StreamProgressEvent {
  type: "progress";
  stage: string;
}

export interface StreamResultEvent<T> {
  type: "result";
  response: StructuredResponse<T>;
}

export type StreamEvent<T> = StreamProgressEvent | StreamResultEvent<T>;

/**
 * 模型适配层
 * 统一封装不同供应商的模型调用，支持服务端环境变量配置或用户级自定义配置。
 */
@Injectable()
export class ModelAdapter {
  private readonly logger = new Logger(ModelAdapter.name);
  private readonly fallbackConfig: ModelConfig;

  constructor(private readonly configService: ConfigService) {
    const provider = this.configService.get<string>("AI_PROVIDER", "openai");
    const apiKey = this.configService.get<string>("OPENAI_API_KEY", "");
    const baseURL = this.configService.get<string>("OPENAI_BASE_URL");
    const model = this.configService.get<string>("OPENAI_MODEL", "gpt-4o-mini");

    this.fallbackConfig = {
      provider,
      apiKey,
      baseURL,
      model,
      enabled: !!apiKey && apiKey.length > 0 && !apiKey.startsWith("sk-xxx"),
    };

    if (!this.fallbackConfig.enabled) {
      this.logger.warn(
        `AI 模型未配置（OPENAI_API_KEY 为空或占位），将使用占位草案降级`,
      );
    } else {
      this.logger.debug(
        `模型适配层初始化完成，provider=${provider}, model=${model}, baseURL=${baseURL ?? "default"}`,
      );
    }
  }

  /**
   * 获取环境变量中的默认配置（用于日志/计费展示）。
   */
  getConfig(modelName?: string): ModelConfig {
    return { ...this.fallbackConfig, model: modelName ?? this.fallbackConfig.model };
  }

  /**
   * 根据用户数据库存储的字段构建 ModelConfig。
   */
  getConfigFromUserFields(fields: {
    aiProvider?: string | null;
    aiModel?: string | null;
    aiBaseUrl?: string | null;
    aiApiKey?: string | null;
  }, modelName?: string): ModelConfig {
    const input: ModelConfig | undefined = fields.aiApiKey
      ? {
          provider: fields.aiProvider ?? this.fallbackConfig.provider,
          apiKey: fields.aiApiKey,
          baseURL: fields.aiBaseUrl ?? this.fallbackConfig.baseURL,
          model: fields.aiModel ?? this.fallbackConfig.model,
          enabled: true,
        }
      : undefined;
    return this.resolveConfig(input);
  }

  private resolveConfig(input?: ModelConfig): ModelConfig {
    if (!input) return this.fallbackConfig;
    const apiKey = input.apiKey?.trim();
    const enabled = !!apiKey && apiKey.length > 0 && !apiKey.startsWith("sk-xxx");
    return {
      provider: input.provider?.trim() || this.fallbackConfig.provider,
      apiKey: apiKey || this.fallbackConfig.apiKey,
      baseURL: input.baseURL?.trim() || this.fallbackConfig.baseURL,
      model: input.model?.trim() || this.fallbackConfig.model,
      enabled: enabled || this.fallbackConfig.enabled,
    };
  }

  private createClient(config: ModelConfig): OpenAI | null {
    if (!config.enabled) return null;
    return new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: 60000,
      maxRetries: 2,
    });
  }

  async generateStructured<T>(
    prompt: string,
    schema: object,
    options: {
      modelName?: string;
      history?: ChatCompletionMessageParam[];
      config?: ModelConfig;
    } = {},
  ): Promise<StructuredResponse<T>> {
    const config = this.resolveConfig(options.config);
    const model = options.modelName?.trim() || config.model;
    const client = this.createClient(config);

    if (!client) {
      return {
        data: null,
        raw: "",
        model,
        error: "AI 模型未配置",
      };
    }

    const start = Date.now();
    try {
      this.logger.debug(
        `调用模型生成结构化输出，provider=${config.provider}, model=${model}, baseURL=${config.baseURL ?? "default"}, prompt 长度: ${prompt.length}`,
      );

      const messages: ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: `你是一个严格的计划教练。请只输出符合以下 JSON Schema 的 JSON 对象，不要添加任何额外解释：\n${JSON.stringify(schema)}`,
        },
      ];

      if (options.history?.length) {
        messages.push(...options.history);
      }

      messages.push({ role: "user", content: prompt });

      const completion = await client.chat.completions.create({
        model,
        messages,
        response_format: { type: "json_object" },
      });

      const raw = completion.choices[0]?.message?.content || "";
      const latency = Date.now() - start;
      this.logger.debug(`模型调用完成，耗时 ${latency}ms`);

      let data: T | null = null;
      try {
        data = JSON.parse(raw) as T;
      } catch (parseErr) {
        this.logger.warn(
          `模型输出 JSON 解析失败: ${(parseErr as Error).message}`,
        );
      }

      return {
        data,
        raw,
        model,
        usage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0,
        },
      };
    } catch (err) {
      const _latency = Date.now() - start;
      const message = (err as Error).message;
      this.logger.error(
        `模型调用失败: ${message} (耗时 ${_latency}ms)`,
        (err as Error).stack,
      );
      return {
        data: null,
        raw: "",
        model,
        error: message,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    }
  }

  /**
   * 使用 OpenAI 兼容 content blocks 生成结构化输出。
   * 将文本 / image_url / video_url 作为 user message content 数组发送，
   * 并附加 system message 携带 JSON Schema。
   */
  async generateStructuredWithContent<T>(
    contentBlocks: ProcessedContent[],
    schema: object,
    options: {
      modelName?: string;
      config?: ModelConfig;
    } = {},
  ): Promise<StructuredResponse<T>> {
    const config = this.resolveConfig(options.config);
    const model = options.modelName?.trim() || config.model;
    const client = this.createClient(config);

    if (!client) {
      return {
        data: null,
        raw: "",
        model,
        error: "AI 模型未配置",
      };
    }

    const start = Date.now();
    try {
      this.logger.debug(
        `调用模型生成结构化输出（content blocks），provider=${config.provider}, model=${model}, baseURL=${config.baseURL ?? "default"}, blocks=${contentBlocks.length}`,
      );

      const messages: ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: `你是一个严格的计划教练。请只输出符合以下 JSON Schema 的 JSON 对象，不要添加任何额外解释：\n${JSON.stringify(schema)}`,
        },
        {
          role: "user",
          content: contentBlocks as any,
        },
      ];

      const completion = await client.chat.completions.create({
        model,
        messages,
        response_format: { type: "json_object" },
      });

      const raw = completion.choices[0]?.message?.content || "";
      const latency = Date.now() - start;
      this.logger.debug(`模型调用完成，耗时 ${latency}ms`);

      let data: T | null = null;
      try {
        data = JSON.parse(raw) as T;
      } catch (parseErr) {
        this.logger.warn(
          `模型输出 JSON 解析失败: ${(parseErr as Error).message}`,
        );
      }

      return {
        data,
        raw,
        model,
        usage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0,
        },
      };
    } catch (err) {
      const _latency = Date.now() - start;
      const message = (err as Error).message;
      this.logger.error(
        `模型调用失败: ${message} (耗时 ${_latency}ms)`,
        (err as Error).stack,
      );
      return {
        data: null,
        raw: "",
        model,
        error: message,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    }
  }

  /**
   * 流式生成结构化输出。
   * 通过 AsyncGenerator 在模型调用前后发送 progress 事件，最终结果以 result 事件返回。
   */
  async *streamProgress<T>(
    prompt: string,
    schema: object,
    options: {
      modelName?: string;
      history?: ChatCompletionMessageParam[];
      config?: ModelConfig;
    } = {},
  ): AsyncGenerator<StreamEvent<T>> {
    yield { type: "progress", stage: "preparing" };

    const config = this.resolveConfig(options.config);
    const model = options.modelName?.trim() || config.model;
    const client = this.createClient(config);

    if (!client) {
      yield {
        type: "result",
        response: {
          data: null,
          raw: "",
          model,
          error: "AI 模型未配置",
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        },
      };
      return;
    }

    yield { type: "progress", stage: "calling_model" };
    const response = await this.generateStructured<T>(prompt, schema, options);

    if (response.error) {
      this.logger.warn(`流式生成失败: ${response.error}`);
    } else {
      this.logger.debug(`流式生成完成，model=${response.model}`);
    }

    yield { type: "result", response };
  }
}
