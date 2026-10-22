import type { LLMError, LLMProvider } from "./types";

const MODEL_ENV: Record<LLMProvider, string> = {
  claude: "CLAUDE_MODEL",
  gemini: "GEMINI_MODEL",
  openai: "OPENAI_MODEL",
};

/** A short message for the browser. The full cause goes to the server log. */
export function llmErrorMessage(error: LLMError, task = "analyze your CV"): string {
  const name = error.provider.toUpperCase();
  switch (error.kind) {
    case "model":
      return `The configured ${name} model isn't available. Check ${MODEL_ENV[error.provider]} in .env.local.`;
    case "auth":
      return `${name} API key is missing or invalid.`;
    case "quota":
      return `${name} has used up its daily quota for the configured models. Try again later, or use an API key with billing enabled.`;
    case "busy":
      return `${name} is temporarily busy. Please try again in a minute.`;
    case "refused":
      return `${name} declined to process this CV.`;
    case "invalid_output":
      return `${name} returned an incomplete response. Please try again.`;
    default:
      return `Failed to ${task} with ${error.provider}. Please try again.`;
  }
}
