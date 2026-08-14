import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources";

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
 * 统一封装不同供应商的模型调用，提供 generateStructured 方法。
 * 支持 OpenAI 官方、DeepSeek、Claude 代理等任意 OpenAI 兼容接口。
 */
@Injectable()
export class ModelAdapter {
  private readonly logger = new Logger(ModelAdapter.name);
  private readonly openai: OpenAI | null = null;
  private readonly config: ModelConfig;

  constructor(private readonly configService: ConfigService) {
    const provider = this.configService.get<string>("AI_PROVIDER", "openai");
    const apiKey = this.configService.get<string>("OPENAI_API_KEY", "");
    const baseURL = this.configService.get<string>("OPENAI_BASE_URL");
    const model = this.configService.get<string>("OPENAI_MODEL", "gpt-4o-mini");

    this.config = {
      provider,
      apiKey,
      baseURL,
      model,
      enabled: !!apiKey && apiKey.length > 0 && !apiKey.startsWith("sk-xxx"),
    };

    if (!this.config.enabled) {
      this.logger.warn(
        `AI 模型未配置（OPENAI_API_KEY 为空或占位），将使用占位草案降级`,
      );
    } else {
      this.openai = new OpenAI({
        apiKey,
        baseURL,
        timeout: 60000,
        maxRetries: 2,
      });
      this.logger.debug(
        `模型适配层初始化完成，provider=${provider}, model=${model}, baseURL=${baseURL ?? "default"}`,
      );
    }
  }

  getConfig(modelName?: string): ModelConfig {
    return { ...this.config, model: modelName ?? this.config.model };
  }

  async generateStructured<T>(
    prompt: string,
    schema: object,
    options: {
      modelName?: string;
      history?: ChatCompletionMessageParam[];
    } = {},
  ): Promise<StructuredResponse<T>> {
    if (!this.openai) {
      return {
        data: null,
        raw: "",
        model: options.modelName ?? this.config.model,
        error: "AI 模型未配置",
      };
    }

    const model = options.modelName ?? this.config.model;
    const start = Date.now();
    try {
      this.logger.debug(
        `调用模型生成结构化输出，provider=${this.config.provider}, model=${model}, prompt 长度: ${prompt.length}`,
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

      const completion = await this.openai.chat.completions.create({
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
   * 注意：当前实现仍在服务端等待完整响应后再返回结果，因此适合"阶段进度"展示，
   * 而非逐 token 打字机效果。
   */
  async *streamProgress<T>(
    prompt: string,
    schema: object,
    options: {
      modelName?: string;
      history?: ChatCompletionMessageParam[];
    } = {},
  ): AsyncGenerator<StreamEvent<T>> {
    yield { type: "progress", stage: "preparing" };

    if (!this.openai) {
      yield {
        type: "result",
        response: {
          data: null,
          raw: "",
          model: options.modelName ?? this.config.model,
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
