import { createHash } from "node:crypto";
import {
  buildRequirementsPrompt,
  buildRewritePrompt,
  REQUIREMENTS_SCHEMA,
  REQUIREMENTS_SYSTEM,
  REWRITE_SCHEMA,
  REWRITE_SYSTEM,
} from "../promptBuilder";
import type {
  DegreeLevel,
  Importance,
  JobRequirements,
  KeywordCategory,
  RequirementKeyword,
  ScoreResult,
} from "../scoring";
import { normalizeText } from "../scoring/sections";
import type { RewriteSuggestion } from "@/types/analysis";
import { LLMClient, LLMError, LLMProvider } from "./types";

// Bump when the extraction prompt changes so cached requirements are refreshed.
const REQUIREMENTS_VERSION = 2;
const CACHE_LIMIT = 200;
const requirementsCache = new Map<string, JobRequirements>();

const CATEGORIES = new Set<KeywordCategory>(["hard_skill", "tool", "soft_skill", "certification", "domain"]);
const DEGREES = new Set<DegreeLevel>(["none", "high_school", "associate", "bachelor", "master", "doctorate"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

export function sanitizeRequirements(data: unknown, provider: LLMProvider): JobRequirements {
  if (!isRecord(data) || !Array.isArray(data.keywords)) {
    throw new LLMError("invalid_output", provider, "The model returned requirements in an unexpected shape.");
  }

  const seen = new Set<string>();
  const keywords: RequirementKeyword[] = [];
  for (const item of data.keywords) {
    if (!isRecord(item) || typeof item.term !== "string") continue;
    const term = item.term.trim();
    const key = term.toLowerCase();
    if (!term || term.length > 60 || seen.has(key)) continue;
    seen.add(key);
    keywords.push({
      term,
      synonyms: stringList(item.synonyms, 5),
      category: CATEGORIES.has(item.category as KeywordCategory) ? (item.category as KeywordCategory) : "hard_skill",
      importance: item.importance === "preferred" ? "preferred" : ("required" as Importance),
    });
  }

  const years = Number(data.minYearsExperience);
  return {
    jobTitle: typeof data.jobTitle === "string" ? data.jobTitle.trim().slice(0, 120) : "",
    titleAliases: stringList(data.titleAliases, 4),
    keywords: keywords.slice(0, 30),
    minYearsExperience: Number.isFinite(years) ? Math.max(0, Math.min(30, Math.round(years))) : 0,
    minDegree: DEGREES.has(data.minDegree as DegreeLevel) ? (data.minDegree as DegreeLevel) : "none",
  };
}

/**
 * Extract structured requirements from a job post. Results are cached per
 * provider + job post, so re-analysing against the same post reuses the exact
 * same requirements and therefore yields the exact same score.
 */
export async function extractRequirements(
  client: LLMClient,
  provider: LLMProvider,
  jobDescription: string,
  options: { useCache?: boolean } = {}
): Promise<JobRequirements> {
  const useCache = options.useCache ?? true;
  const cacheKey = createHash("sha256")
    .update(`${REQUIREMENTS_VERSION}\n${provider}\n${jobDescription.trim()}`)
    .digest("hex");
  const cached = useCache ? requirementsCache.get(cacheKey) : undefined;
  if (cached) return cached;

  const data = await client.generateJson({
    name: "job_requirements",
    system: REQUIREMENTS_SYSTEM,
    prompt: buildRequirementsPrompt(jobDescription),
    schema: REQUIREMENTS_SCHEMA,
    // Headroom for models whose thinking tokens count against the output limit.
    maxTokens: 8000,
    effort: "low",
  });
  const requirements = sanitizeRequirements(data, provider);
  if (requirements.keywords.length === 0) {
    throw new LLMError("invalid_output", provider, "No keywords could be extracted from the job post.");
  }

  if (!useCache) return requirements;
  if (requirementsCache.size >= CACHE_LIMIT) {
    requirementsCache.delete(requirementsCache.keys().next().value!);
  }
  requirementsCache.set(cacheKey, requirements);
  return requirements;
}

export interface AddedKeyword {
  keyword: string;
  /** The model's verbatim quote from the CV; checked in lib/verifyRewrite.ts. */
  evidence: string;
}

export interface RewriteResult {
  suggestions: RewriteSuggestion[];
  improvedCv: string;
  addedKeywords: AddedKeyword[];
  unaddressedKeywords: string[];
}

// A model hedging an invented claim: "Message Queues (simulated)", "[add metric]".
const PLACEHOLDER = /\b(placeholders?|simulated|hypothetical|tbd|todo|if applicable)\b|\[[^\]]*\]/i;

const MONTHS: Record<string, string> = {
  january: "jan", february: "feb", march: "mar", april: "apr", june: "jun", july: "jul",
  august: "aug", september: "sep", sept: "sep", october: "oct", november: "nov", december: "dec",
};

/** Text as the scoring engine reads it: case, punctuation and month spelling don't matter. */
function readsAs(text: string): string {
  return normalizeText(text)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\b[a-z]+\b/g, (word) => MONTHS[word] ?? word)
    .trim();
}

export function sanitizeRewrite(data: unknown, provider: LLMProvider): RewriteResult {
  if (!isRecord(data) || typeof data.improvedCv !== "string" || data.improvedCv.trim().length === 0) {
    throw new LLMError("invalid_output", provider, "The model did not return an improved CV.");
  }

  const suggestions: RewriteSuggestion[] = (Array.isArray(data.suggestions) ? data.suggestions : [])
    .filter(isRecord)
    .filter((item) =>
      ["section", "original", "improved", "reason"].every((field) => typeof item[field] === "string")
    )
    .map((item) => ({
      section: item.section as string,
      original: item.original as string,
      improved: item.improved as string,
      reason: item.reason as string,
    }));

  // Undo placeholder claims in the CV too, so they can't add keywords or score.
  let improvedCv = data.improvedCv.trim();
  for (const suggestion of suggestions) {
    if (PLACEHOLDER.test(suggestion.improved) && !PLACEHOLDER.test(suggestion.original)) {
      improvedCv = improvedCv.split(suggestion.improved).join(suggestion.original);
    }
  }

  return {
    suggestions: suggestions.filter(
      (suggestion) =>
        !(PLACEHOLDER.test(suggestion.improved) && !PLACEHOLDER.test(suggestion.original)) &&
        // Same text to an ATS (e.g. "Sep. 2024" -> "Sep 2024"): not worth the user's time.
        readsAs(suggestion.improved) !== readsAs(suggestion.original)
    ),
    improvedCv,
    addedKeywords: (Array.isArray(data.addedKeywords) ? data.addedKeywords : [])
      .filter(isRecord)
      .filter((item) => typeof item.keyword === "string" && typeof item.evidence === "string")
      .map((item) => ({ keyword: (item.keyword as string).trim(), evidence: (item.evidence as string).trim() }))
      .slice(0, 30),
    unaddressedKeywords: stringList(data.unaddressedKeywords, 30),
  };
}

export async function rewriteCv(
  client: LLMClient,
  provider: LLMProvider,
  cvText: string,
  jobDescription: string,
  score: ScoreResult
): Promise<RewriteResult> {
  const data = await client.generateJson({
    name: "cv_rewrite",
    system: REWRITE_SYSTEM,
    prompt: buildRewritePrompt(cvText, jobDescription, score),
    schema: REWRITE_SCHEMA,
    maxTokens: 16000,
    effort: "medium",
  });
  return sanitizeRewrite(data, provider);
}
