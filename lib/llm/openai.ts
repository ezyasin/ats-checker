/**
 * OpenAI LLM Provider
 */

import OpenAI from "openai";
import { AnalysisResponse, LLMClient } from "./types";
import { buildAnalysisPrompt } from "../promptBuilder";

export class OpenAIClient implements LLMClient {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async analyze(cvText: string, jobDescription: string): Promise<AnalysisResponse> {
    const prompt = buildAnalysisPrompt(cvText, jobDescription);
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
