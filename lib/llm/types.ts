/**
 * Common types for all LLM providers
 */

export type LLMProvider = "claude" | "gemini" | "openai";

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
}

export interface AnalysisResponse {
  atsScore: number;
  verdict: "Strong Match" | "Good Match" | "Moderate Match" | "Weak Match";
  matchedKeywords: string[];
  missingKeywords: string[];
  sectionScores: {
    summary: number;
    skills: number;
    experience: number;
    education: number;
  };
  suggestions: Array<{
    section: string;
    priority: "critical" | "important" | "optional";
    original: string;
    suggested: string;
    reason: string;
  }>;
  improvedCv: string;
}

export interface LLMClient {
  analyze(cvText: string, jobDescription?: string): Promise<AnalysisResponse>;
}
