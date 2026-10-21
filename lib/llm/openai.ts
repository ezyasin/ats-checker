/**
 * OpenAI LLM Provider
 */

import OpenAI from "openai";
import { JsonRequest, LLMClient, LLMError, parseJsonObject } from "./types";

export class OpenAIClient implements LLMClient {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateJson(request: JsonRequest): Promise<unknown> {
    const model = process.env.OPENAI_MODEL || "gpt-4o";

    let content: string | null | undefined;
    try {
      const completion = await this.client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: request.name, schema: request.schema, strict: true },
        },
        max_completion_tokens: request.maxTokens,
        // Reasoning models (o-series, gpt-5) only accept the default temperature.
        ...(model.startsWith("gpt-4") ? { temperature: 0 } : {}),
      });

      const choice = completion.choices[0];
      if (choice?.message.refusal) {
        throw new LLMError("refused", "openai", "OpenAI declined to process this CV.");
      }
      if (choice?.finish_reason === "content_filter") {
        throw new LLMError("refused", "openai", "OpenAI's content filter blocked the response.");
      }
      if (choice?.finish_reason === "length") {
        throw new LLMError("invalid_output", "openai", "OpenAI's response was cut off before it finished.");
      }
      content = choice?.message.content;
    } catch (error) {
      throw toLLMError(error, model);
    }

    if (!content) {
      throw new LLMError("invalid_output", "openai", "Empty response from OpenAI.");
    }
    return parseJsonObject(content, "openai");
  }
}

export function toLLMError(error: unknown, model: string): LLMError {
  if (error instanceof LLMError) return error;
  const cause = { cause: error };
  if (error instanceof OpenAI.AuthenticationError || error instanceof OpenAI.PermissionDeniedError) {
    return new LLMError("auth", "openai", "The OpenAI API key was rejected.", cause);
  }
  if (error instanceof OpenAI.NotFoundError) {
    return new LLMError("model", "openai", `OpenAI model "${model}" was not found or this key can't use it.`, cause);
  }
  if (error instanceof OpenAI.RateLimitError) {
    // Out of credit is also a 429; only its code tells it apart from a rate limit.
    const quota = error.code === "insufficient_quota" || error.message.toLowerCase().includes("quota");
    return quota
      ? new LLMError("quota", "openai", "The OpenAI account is out of credit or over its quota.", cause)
      : new LLMError("busy", "openai", "OpenAI is rate limited.", cause);
  }
  if (error instanceof OpenAI.APIError && error.status !== undefined && error.status >= 500) {
    return new LLMError("busy", "openai", "OpenAI is temporarily unavailable.", cause);
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return new LLMError("busy", "openai", "Could not reach the OpenAI API.", cause);
  }
  return new LLMError("unknown", "openai", error instanceof Error ? error.message : "Unknown OpenAI error", cause);
}
