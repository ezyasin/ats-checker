/**
 * OpenAI LLM Provider
 */

import OpenAI from "openai";
import { AnalysisResponse, LLMClient } from "./types";
import { buildAnalysisPrompt, buildCVOnlyAnalysisPrompt } from "../promptBuilder";

export class OpenAIClient implements LLMClient {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async analyze(cvText: string, jobDescription?: string): Promise<AnalysisResponse> {
    const prompt = jobDescription 
      ? buildAnalysisPrompt(cvText, jobDescription)
      : buildCVOnlyAnalysisPrompt(cvText);
    const model = process.env.OPENAI_MODEL || "gpt-4o";

    const message = await this.client.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    const content = message.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    return this.parseResponse(content);
  }

  private parseResponse(text: string): AnalysisResponse {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not extract JSON from OpenAI response");
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
