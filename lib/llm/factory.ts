/**
 * LLM Provider Factory - Routes to the correct LLM client
 */

import { LLMProvider, LLMClient } from "./types";
import { ClaudeClient } from "./anthropic";
import { GeminiClient } from "./gemini";
import { OpenAIClient } from "./openai";

export function createLLMClient(provider: LLMProvider): LLMClient {
  switch (provider) {
    case "claude": {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error("ANTHROPIC_API_KEY environment variable is not set");
      }
      return new ClaudeClient(apiKey);
    }

    case "gemini": {
      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error("GOOGLE_API_KEY environment variable is not set");
      }
      return new GeminiClient(apiKey);
    }

    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY environment variable is not set");
      }
      return new OpenAIClient(apiKey);
    }

    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

export function getAvailableProviders(): LLMProvider[] {
  const providers: LLMProvider[] = [];

  if (process.env.ANTHROPIC_API_KEY) providers.push("claude");
  if (process.env.GOOGLE_API_KEY) providers.push("gemini");
  if (process.env.OPENAI_API_KEY) providers.push("openai");

  return providers;
}

/** The requested provider if it's configured, else the default; null if none is configured. */
export function resolveProvider(requested: unknown): LLMProvider | null {
  const available = getAvailableProviders();
  if (available.length === 0) return null;
  return available.includes(requested as LLMProvider) ? (requested as LLMProvider) : getDefaultProvider();
}

export function getDefaultProvider(): LLMProvider {
  const preferred = (process.env.LLM_PROVIDER as LLMProvider) || "claude";
  const available = getAvailableProviders();

  if (available.includes(preferred)) {
    return preferred;
  }

  return available[0] || "claude";
}
