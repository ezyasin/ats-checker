export interface SectionScore {
  summary: number;
  skills: number;
  experience: number;
  education: number;
}

export interface Suggestion {
  priority: "critical" | "important" | "optional";
  section: string;
  original: string;
  improved: string;
  reason: string;
}

export interface AnalysisResult {
  atsScore: number;
  verdict: "Poor" | "Fair" | "Good" | "Excellent";
  matchedKeywords: string[];
  missingKeywords: string[];
  sectionScores: SectionScore;
  suggestions: Suggestion[];
  originalCv: string;
  improvedCv: string;
}

export interface AnalysisRequest {
  cvText: string;
  jobDescription: string;
}

export interface ExportRequest {
  improvedCv: string;
  format: "pdf" | "docx";
}
