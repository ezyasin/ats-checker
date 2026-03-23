import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export function getModel(): string {
  return process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";
}

export { client };
