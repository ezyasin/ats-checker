/**
 * Google Gemini LLM Provider
 */

import {
  GoogleGenerativeAI,
  GoogleGenerativeAIFetchError,
  type ResponseSchema,
} from "@google/generative-ai";
import { JsonRequest, LLMClient, LLMError, parseJsonObject } from "./types";

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
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: toGeminiSchema(request.schema),
          maxOutputTokens: request.maxTokens,
        },
      });
      const maxAttempts = 3;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const result = await gemini.generateContent(request.prompt);
          return parseJsonObject(result.response.text(), "gemini");
        } catch (error) {
          lastError = toLLMError(error);
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

function toLLMError(error: unknown): LLMError {
  if (error instanceof LLMError) return error;
  if (error instanceof GoogleGenerativeAIFetchError) {
    const message = error.message.toLowerCase();
    if (error.status === 401 || error.status === 403 || message.includes("api key not valid")) {
      return new LLMError("auth", "gemini", "The Google API key was rejected.");
    }
    if (message.includes("quota exceeded")) {
      return new LLMError("quota", "gemini", error.message);
    }
    if (error.status === 429 || error.status === 503 || error.status === 500) {
      return new LLMError("busy", "gemini", error.message);
    }
  }
  return new LLMError("unknown", "gemini", error instanceof Error ? error.message : "Unknown Gemini error");
}
