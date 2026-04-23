/**
 * Google Gemini LLM Provider
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { AnalysisResponse, LLMClient } from "./types";
import { buildAnalysisPrompt, buildCVOnlyAnalysisPrompt } from "../promptBuilder";

export class GeminiClient implements LLMClient {
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async analyze(cvText: string, jobDescription?: string): Promise<AnalysisResponse> {
    const prompt = jobDescription 
      ? buildAnalysisPrompt(cvText, jobDescription)
      : buildCVOnlyAnalysisPrompt(cvText);
    const models = this.getModelChain();
    const failures: string[] = [];

    for (const model of models) {
      const gemini = this.client.getGenerativeModel({ model });
      const maxAttempts = 3;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const result = await gemini.generateContent(prompt);
          const response = result.response;
          const text = response.text();

          return this.parseResponse(text);
        } catch (error) {
          if (attempt === maxAttempts || !this.shouldRetrySameModel(error)) {
            failures.push(`${model}: ${this.getErrorMessage(error)}`);
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
        }
      }
    }

    throw new Error(`Gemini model chain failed. ${failures.join(" | ")}`);
  }

  private parseResponse(text: string): AnalysisResponse {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not extract JSON from Gemini response");
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

  private getModelChain(): string[] {
    const primary = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const fallback = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash-lite";

    return Array.from(new Set([primary, fallback].filter(Boolean)));
  }

  private shouldRetrySameModel(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toLowerCase();
    if (message.includes("quota exceeded")) {
      return false;
    }

    return (
      error.message.includes("[503 Service Unavailable]") ||
      error.message.includes("[429") ||
      message.includes("high demand") ||
      message.includes("rate limit")
    );
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return "Unknown Gemini error";
  }
}
