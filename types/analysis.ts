import type { JobRequirements, ScoreResult } from "@/lib/scoring/types";

export type { SectionScores as SectionScore } from "@/lib/scoring/types";

export interface Suggestion {
  priority: "critical" | "important" | "optional";
  section: string;
  original: string;
  improved: string;
  reason: string;
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
  improvementHistory?: ImprovementHistoryEntry[];
}

export interface ExportRequest {
  improvedCv: string;
  format: "docx" | "txt" | "tex";
}
