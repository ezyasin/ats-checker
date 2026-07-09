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

export interface ImprovementHistoryEntry {
  date: string;
  score: number;
  changes: string[];
}

// Enhanced ATS metrics for detailed analysis
export interface ATSMetrics {
  parsingScore: number; // How well ATS can parse the resume (0-100)
  formattingScore: number; // ATS-friendly formatting (0-100)
  keywordScore: number; // Keyword optimization (0-100)
  sectionScore: number; // Proper section structure (0-100)
  aTSCompatibility: number; // Overall ATS compatibility (0-100)
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
  
  // Enhanced ATS analysis fields
  atsMetrics?: ATSMetrics;
  parsingIssues?: string[];
  formattingIssues?: string[];
  improvementHistory?: ImprovementHistoryEntry[];
}

export interface AnalysisRequest {
  cvText: string;
  jobDescription: string;
}

export interface ExportRequest {
  improvedCv: string;
  format: "docx" | "txt" | "tex";
}
