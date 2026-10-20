/**
 * Anthropic Claude LLM Provider
 */

import Anthropic from "@anthropic-ai/sdk";
import { JsonRequest, LLMClient, LLMError, parseJsonObject } from "./types";

export class ClaudeClient implements LLMClient {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateJson(request: JsonRequest): Promise<unknown> {
    const model = process.env.CLAUDE_MODEL || "claude-opus-5-5";

    let message: Anthropic.Message;
    try {
      // Streamed so a long rewrite can't hit the HTTP timeout.
      message = await this.client.messages
        .stream({
          model,
          max_tokens: request.maxTokens,
          system: request.system,
          messages: [{ role: "user", content: request.prompt }],
          output_config: {
            effort: request.effort,
            format: { type: "json_schema", schema: request.schema },
          },
        })
        .finalMessage();
    } catch (error) {
      throw toLLMError(error);
    }

    if (message.stop_reason === "refusal") {
      throw new LLMError("refused", "claude", "Claude declined to process this CV.");
    }
    if (message.stop_reason === "max_tokens") {
      throw new LLMError("invalid_output", "claude", "Claude's response was cut off before it finished.");
    }

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");
    return parseJsonObject(text, "claude");
  }
}

function toLLMError(error: unknown): LLMError {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new LLMError("auth", "claude", "The Anthropic API key was rejected.");
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new LLMError("busy", "claude", "Claude is rate limited.");
  }
  if (error instanceof Anthropic.APIError && error.status !== undefined && error.status >= 500) {
    return new LLMError("busy", "claude", "Claude is temporarily unavailable.");
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new LLMError("busy", "claude", "Could not reach the Anthropic API.");
  }
  return new LLMError("unknown", "claude", error instanceof Error ? error.message : "Unknown Claude error");
}
