/**
 * Anthropic Claude LLM Provider
 */

import Anthropic from "@anthropic-ai/sdk";
import { AnalysisResponse, LLMClient } from "./types";
import { buildAnalysisPrompt } from "../promptBuilder";

export class ClaudeClient implements LLMClient {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async analyze(cvText: string, jobDescription: string): Promise<AnalysisResponse> {
    const prompt = buildAnalysisPrompt(cvText, jobDescription);
    const model = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";

    const message = await this.client.messages.create({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    return this.parseResponse(content.text);
  }

  private parseResponse(text: string): AnalysisResponse {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not extract JSON from Claude response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    this.validateResponse(parsed);
    return parsed;
  }

  private validateResponse(data: any): void {
    if (typeof data.atsScore !== "number" || data.atsScore < 0 || data.atsScore > 100) {
      throw new Error("Invalid ATS score");
    }
    if (!Array.isArray(data.matchedKeywords) || !Array.isArray(data.missingKeywords)) {
      throw new Error("Invalid keywords format");
    }
    if (!Array.isArray(data.suggestions)) {
      throw new Error("Invalid suggestions format");
    }
    if (typeof data.improvedCv !== "string" || data.improvedCv.length === 0) {
      throw new Error("Missing or invalid improvedCv in response");
    }
  }
}
