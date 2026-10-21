/**
 * Types for the deterministic ATS scoring engine.
 *
 * The LLM only produces `JobRequirements`. Everything else here is computed
 * by pure functions, so the same CV + requirements always yield the same score.
 */

export type KeywordCategory =
  | "hard_skill"
  | "tool"
  | "soft_skill"
  | "certification"
  | "domain";

export type Importance = "required" | "preferred";

export type DegreeLevel =
  | "none"
  | "high_school"
  | "associate"
  | "bachelor"
  | "master"
  | "doctorate";

export interface RequirementKeyword {
  term: string;
  synonyms: string[];
  category: KeywordCategory;
  importance: Importance;
}

export interface JobRequirements {
  jobTitle: string;
  titleAliases: string[];
  keywords: RequirementKeyword[];
  /** 0 when the job post states no minimum. */
  minYearsExperience: number;
  /** "none" when no degree is required or "equivalent experience" is accepted. */
  minDegree: DegreeLevel;
}

export type SectionKey =
  | "contact"
  | "summary"
  | "experience"
  | "skills"
  | "education"
  | "certifications"
  | "projects"
  | "other";

export interface CvSection {
  key: SectionKey;
  heading: string;
  text: string;
}

export interface KeywordMatch {
  term: string;
  category: KeywordCategory;
  importance: Importance;
  matched: boolean;
  /** The variant or synonym that matched, when it differs from `term`. */
  matchedAs?: string;
  occurrences: number;
  sections: SectionKey[];
  /** In the text, but added by the rewrite without evidence, so scored as missing. */
  unverified?: boolean;
}

export interface ScoreCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export type ComponentKey =
  | "keywords"
  | "structure"
  | "experience"
  | "title"
  | "education";

export interface ScoreComponent {
  key: ComponentKey;
  label: string;
  /** 0-100 for this component on its own. */
  score: number;
  /** Share of the total score, e.g. 45 for keywords. */
  weight: number;
  /** Weighted contribution to the total (score * weight / 100). */
  points: number;
  summary: string;
  checks: ScoreCheck[];
}

export interface SectionScores {
  summary: number;
  skills: number;
  experience: number;
  education: number;
}

export type Verdict = "Poor" | "Fair" | "Good" | "Excellent";

export interface ScoreResult {
  total: number;
  verdict: Verdict;
  components: ScoreComponent[];
  keywordMatches: KeywordMatch[];
  sectionScores: SectionScores;
  detectedSections: SectionKey[];
  yearsOfExperience: number;
  detectedDegree: DegreeLevel;
}
