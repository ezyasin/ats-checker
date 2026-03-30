/**
 * Google Gemini LLM Provider
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { AnalysisResponse, LLMClient } from "./types";
import { buildAnalysisPrompt } from "../promptBuilder";

export class GeminiClient implements LLMClient {
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async analyze(cvText: string, jobDescription: string): Promise<AnalysisResponse> {
    const prompt = buildAnalysisPrompt(cvText, jobDescription);
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    const gemini = this.client.getGenerativeModel({ model });

    const result = await gemini.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    return this.parseResponse(text);
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
