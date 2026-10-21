/**
 * Common types for all LLM providers.
 *
 * Providers are thin adapters: they turn a prompt + JSON schema into parsed
 * JSON. Prompts, validation and scoring live outside the providers so every
 * provider behaves the same way.
 */

export type LLMProvider = "claude" | "gemini" | "openai";

export interface JsonRequest {
  /** Short identifier used as the schema name by providers that need one. */
  name: string;
  system: string;
  prompt: string;
  /** JSON Schema for the response. Objects must set additionalProperties: false. */
  schema: Record<string, unknown>;
  maxTokens: number;
  /** "low" for extraction, "medium" for writing. Providers without effort ignore it. */
  effort: "low" | "medium";
}

export interface LLMClient {
  generateJson(request: JsonRequest): Promise<unknown>;
}

/** "model": the configured model name doesn't exist or the key can't use it. */
export type LLMErrorKind = "auth" | "busy" | "quota" | "model" | "invalid_output" | "refused" | "unknown";

export class LLMError extends Error {
  constructor(
    readonly kind: LLMErrorKind,
    readonly provider: LLMProvider,
    message: string,
    /** `cause` keeps the provider SDK's original error for the server log. */
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = "LLMError";
  }
}

/** One log line: our message plus the provider's own. Never includes prompt text. */
export function describeLLMError(error: LLMError): string {
  const cause = error.cause instanceof Error ? error.cause.message : undefined;
  const detail = cause && cause !== error.message ? ` | provider said: ${cause}` : "";
  return `(${error.kind}) ${error.message}${detail}`;
}

/** Parse a JSON object from model text, tolerating stray code fences. */
export function parseJsonObject(text: string, provider: LLMProvider): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new LLMError("invalid_output", provider, "The model response contained no JSON object.");
  }
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new LLMError("invalid_output", provider, "The model returned malformed JSON.");
  }
}
