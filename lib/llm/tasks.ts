import { createHash } from "node:crypto";
import {
  buildCoverLetterPrompt,
  buildRequirementsPrompt,
  buildRewritePrompt,
  COVER_LETTER_SCHEMA,
  COVER_LETTER_SYSTEM,
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
import { canonicalCv, cvFromFields, cvToMarkdown, normalizeCv } from "../cvModel";
import type { RewriteSuggestion } from "@/types/analysis";
import { LLMClient, LLMError, LLMProvider } from "./types";

// Bump when extraction changes so cached requirements are refreshed.
const REQUIREMENTS_VERSION = 3;
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

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15,
};
const NUMBER = `\\d{1,2}|${Object.keys(NUMBER_WORDS).join("|")}`;
// "3+ years", "3-5 years", "3 to 5 yrs", "five years", "3 yıl"; the first number is the minimum.
const YEARS_PHRASE = new RegExp(
  `\\b(${NUMBER})\\s*\\+?\\s*(?:(?:-|–|to)\\s*(?:${NUMBER})\\s*\\+?\\s*)?(?:years?|yrs?|yıl)\\b`,
  "gi"
);

/**
 * Models misread numbers: Gemini 2.5 Flash returned 36 for "3+ years". Keep
 * the model's minimum only if the post actually states it; otherwise use the
 * smallest year figure the post mentions.
 */
export function reconcileYears(modelYears: number, jobDescription: string): number {
  const stated = [...jobDescription.matchAll(YEARS_PHRASE)]
    .map((match) => NUMBER_WORDS[match[1].toLowerCase()] ?? Number(match[1]))
    .filter((years) => years > 0 && years <= 30);
  if (modelYears === 0 || stated.length === 0 || stated.includes(modelYears)) return modelYears;
  return Math.min(...stated);
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
  const sanitized = sanitizeRequirements(data, provider);
  const requirements = {
    ...sanitized,
    minYearsExperience: reconcileYears(sanitized.minYearsExperience, jobDescription),
  };
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

// A suggestion should change a bullet or a sentence. Gemini Flash-Lite returned
// whole roles (employer, title, dates and every bullet) as one "suggestion".
const MAX_SUGGESTION_LINES = 2;

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

/** The improved CV as canonical markdown: structured fields, or markdown from older prompts. */
function improvedCvMarkdown(value: unknown, originalCv: string): string {
  if (typeof value === "string") return value.trim() ? canonicalCv(value, originalCv) : "";
  const model = cvFromFields(value);
  return model ? cvToMarkdown(normalizeCv(model, originalCv)) : "";
}

export function sanitizeRewrite(data: unknown, provider: LLMProvider, originalCv = ""): RewriteResult {
  const markdown = isRecord(data) ? improvedCvMarkdown(data.improvedCv, originalCv) : "";
  if (!isRecord(data) || markdown.length === 0) {
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
  let improvedCv = markdown;
  for (const suggestion of suggestions) {
    if (PLACEHOLDER.test(suggestion.improved) && !PLACEHOLDER.test(suggestion.original)) {
      improvedCv = improvedCv.split(suggestion.improved).join(suggestion.original);
    }
  }

  // Models sometimes repeat a suggestion for the same line; keep the first.
  const seen = new Set<string>();
  return {
    suggestions: suggestions.filter((suggestion) => {
      const key = readsAs(suggestion.original);
      if (seen.has(key)) return false;
      seen.add(key);
      return (
        suggestion.original.split("\n").filter((line) => line.trim()).length <= MAX_SUGGESTION_LINES &&
        !(PLACEHOLDER.test(suggestion.improved) && !PLACEHOLDER.test(suggestion.original)) &&
        // Same text to an ATS (e.g. "Sep. 2024" -> "Sep 2024"): not worth the user's time.
        readsAs(suggestion.improved) !== readsAs(suggestion.original)
      );
    }),
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
  return sanitizeRewrite(data, provider, cvText);
}

// A letter shorter than this isn't a cover letter; a bracket is an unfilled placeholder.
const MIN_LETTER_WORDS = 120;
const LETTER_PLACEHOLDER = /\[[^\]]+\]/;

export function sanitizeCoverLetter(data: unknown, provider: LLMProvider): string {
  const letter = isRecord(data) && typeof data.letter === "string" ? data.letter.trim() : "";
  if (letter.split(/\s+/).length < MIN_LETTER_WORDS) {
    throw new LLMError("invalid_output", provider, "The model returned a cover letter that is too short.");
  }
  if (LETTER_PLACEHOLDER.test(letter)) {
    throw new LLMError("invalid_output", provider, "The model left a placeholder such as [Company] in the letter.");
  }
  return letter;
}

export async function writeCoverLetter(
  client: LLMClient,
  provider: LLMProvider,
  cvText: string,
  jobDescription: string,
  score: ScoreResult
): Promise<string> {
  const data = await client.generateJson({
    name: "cover_letter",
    system: COVER_LETTER_SYSTEM,
    prompt: buildCoverLetterPrompt(cvText, jobDescription, score),
    schema: COVER_LETTER_SCHEMA,
    maxTokens: 6000,
    effort: "medium",
    varied: true,
  });
  return sanitizeCoverLetter(data, provider);
}
