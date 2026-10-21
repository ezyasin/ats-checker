import type { JobRequirements, ScoreResult } from "@/lib/scoring/types";

export type { SectionScores as SectionScore } from "@/lib/scoring/types";

/** A rewrite as the model returns it. */
export interface RewriteSuggestion {
  section: string;
  original: string;
  improved: string;
  reason: string;
}

/** A rewrite ranked by the scoring engine (lib/suggestions.ts), not by the model. */
export interface Suggestion extends RewriteSuggestion {
  priority: "critical" | "important" | "optional";
  /** Missing job keywords the change adds. */
  adds: string[];
  /** Labels of failed structure checks the change fixes. */
  fixes: string[];
}

export interface ImprovementHistoryEntry {
  date: string;
  score: number;
  changes: string[];
}

export interface AnalysisResult {
  atsScore: number;
  verdict: ScoreResult["verdict"];
  matchedKeywords: string[];
  missingKeywords: string[];
  sectionScores: ScoreResult["sectionScores"];
  suggestions: Suggestion[];
  originalCv: string;
  improvedCv: string;

  /** The requirements the LLM extracted from the job post. */
  requirements: JobRequirements;
  /** Full deterministic breakdown for the original CV. */
  scoring: ScoreResult;
  /** The improved CV scored by the same engine. */
  improvedScoring: ScoreResult;
  /** Missing keywords the rewrite could not add without inventing experience. */
  unaddressedKeywords: string[];
  /** Missing keywords the rewrite added, with the CV quote that backs each one. */
  keywordEvidence: Record<string, string>;
  /** Added without evidence and still in the improved CV; not counted in its score. */
  unverifiedKeywords: string[];
  improvementHistory?: ImprovementHistoryEntry[];
}

export interface ExportRequest {
  improvedCv: string;
  format: "docx" | "txt" | "tex";
}
