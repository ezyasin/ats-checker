/**
 * Google Gemini LLM Provider
 */

import {
  FinishReason,
  GoogleGenerativeAI,
  GoogleGenerativeAIFetchError,
  type GenerateContentResult,
  type ResponseSchema,
} from "@google/generative-ai";
import { JsonRequest, LLMClient, LLMError, describeLLMError, parseJsonObject } from "./types";

const BLOCKED = new Set<string>([
  FinishReason.SAFETY,
  FinishReason.RECITATION,
  FinishReason.BLOCKLIST,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.SPII,
]);

export class GeminiClient implements LLMClient {
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generateJson(request: JsonRequest): Promise<unknown> {
    const models = this.getModelChain();
    let lastError: LLMError | null = null;

    for (const model of models) {
      const gemini = this.client.getGenerativeModel({
        model,
        systemInstruction: request.system,
        generationConfig: {
          temperature: request.varied ? 1 : 0,
          responseMimeType: "application/json",
          responseSchema: toGeminiSchema(request.schema),
          maxOutputTokens: request.maxTokens,
        },
      });
      const maxAttempts = 3;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const result = await gemini.generateContent(request.prompt);
          return parseResult(result, request.maxTokens);
        } catch (error) {
          lastError = toLLMError(error, model);
          // Never log prompt or response text: they contain the CV.
          console.warn(`[gemini] ${model} attempt ${attempt} failed ${describeLLMError(lastError)}`);
          if (attempt === maxAttempts || lastError.kind !== "busy") break;
          await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
        }
      }

      // A bad key won't work on the fallback model either.
      if (lastError?.kind === "auth") break;
    }

    throw lastError ?? new LLMError("unknown", "gemini", "Gemini model chain failed.");
  }

  private getModelChain(): string[] {
    const primary = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const fallback = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash-lite";

    return Array.from(new Set([primary, fallback].filter(Boolean)));
  }
}

function parseResult(result: GenerateContentResult, maxTokens: number): unknown {
  const blockReason = result.response.promptFeedback?.blockReason;
  const finishReason = result.response.candidates?.[0]?.finishReason;
  if (blockReason || (finishReason && BLOCKED.has(finishReason))) {
    throw new LLMError("refused", "gemini", `Gemini blocked the response (${blockReason ?? finishReason}).`);
  }
  if (finishReason === FinishReason.MAX_TOKENS) {
    throw new LLMError("invalid_output", "gemini", `The response hit the ${maxTokens}-token limit before the JSON was complete.`);
  }
  return parseJsonObject(result.response.text(), "gemini");
}

/**
 * Gemini's responseSchema is an OpenAPI subset: no additionalProperties, and
 * string enums need format "enum".
 */
function toGeminiSchema(schema: Record<string, unknown>): ResponseSchema {
  const convert = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(convert);
    if (typeof node !== "object" || node === null) return node;

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === "additionalProperties") continue;
      result[key] = key === "enum" ? value : convert(value);
    }
    if (result.type === "string" && Array.isArray(result.enum)) result.format = "enum";
    return result;
  };
  return convert(schema) as ResponseSchema;
}

export function toLLMError(error: unknown, model: string): LLMError {
  if (error instanceof LLMError) return error;
  const cause = { cause: error };
  if (error instanceof GoogleGenerativeAIFetchError) {
    const message = error.message.toLowerCase();
    if (error.status === 401 || error.status === 403 || message.includes("api key not valid")) {
      return new LLMError("auth", "gemini", "The Google API key was rejected.", cause);
    }
    if (error.status === 404) {
      return new LLMError("model", "gemini", `Gemini model "${model}" was not found.`, cause);
    }
    // Free-tier daily limits come back as 429 "You exceeded your current quota"
    // (not "quota exceeded"). Retrying in seconds can't help, so fall back at once.
    const dailyLimit = JSON.stringify(error.errorDetails ?? []).includes("PerDay");
    if (message.includes("quota exceeded") || (error.status === 429 && dailyLimit)) {
      return new LLMError("quota", "gemini", `Gemini's daily quota for "${model}" is used up.`, cause);
    }
    if (error.status === 429 || error.status === 503 || error.status === 500) {
      return new LLMError("busy", "gemini", `Gemini "${model}" is busy or rate limited.`, cause);
    }
  }
  return new LLMError("unknown", "gemini", error instanceof Error ? error.message : "Unknown Gemini error", cause);
}
