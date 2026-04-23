/**
 * Anthropic Claude LLM Provider
 */

import Anthropic from "@anthropic-ai/sdk";
import { AnalysisResponse, LLMClient } from "./types";
import { buildAnalysisPrompt, buildCVOnlyAnalysisPrompt } from "../promptBuilder";

export class ClaudeClient implements LLMClient {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async analyze(cvText: string, jobDescription?: string): Promise<AnalysisResponse> {
    const prompt = jobDescription 
      ? buildAnalysisPrompt(cvText, jobDescription)
      : buildCVOnlyAnalysisPrompt(cvText);
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

  private validateResponse(data: unknown): asserts data is AnalysisResponse {
    if (!data || typeof data !== "object") {
      throw new Error("Invalid response payload");
    }

    const candidate = data as Record<string, unknown>;

    if (typeof candidate.atsScore !== "number" || candidate.atsScore < 0 || candidate.atsScore > 100) {
      throw new Error("Invalid ATS score");
    }
    if (!Array.isArray(candidate.matchedKeywords) || !Array.isArray(candidate.missingKeywords)) {
      throw new Error("Invalid keywords format");
    }
    if (!Array.isArray(candidate.suggestions)) {
      throw new Error("Invalid suggestions format");
    }
    if (
      !candidate.suggestions.every((suggestion) => {
        if (!suggestion || typeof suggestion !== "object") return false;
        const entry = suggestion as Record<string, unknown>;
        return (
          typeof entry.section === "string" &&
          typeof entry.priority === "string" &&
          typeof entry.original === "string" &&
          typeof entry.improved === "string" &&
          typeof entry.reason === "string"
        );
      })
    ) {
      throw new Error("Invalid suggestion payload");
    }
    if (typeof candidate.improvedCv !== "string" || candidate.improvedCv.length === 0) {
      throw new Error("Missing or invalid improvedCv in response");
    }
  }
}
