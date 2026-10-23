import { matchDateRange } from "@/lib/scoring/experience";
import { matchKeywords, termAliases } from "@/lib/scoring/keywords";
import { normalizeText } from "@/lib/scoring/sections";
import type { JobRequirements, RequirementKeyword, ScoreResult } from "@/lib/scoring/types";
import type { RewriteResult } from "@/lib/llm/tasks";
import type { RewriteSuggestion } from "@/types/analysis";

export interface VerifiedRewrite {
  suggestions: RewriteSuggestion[];
  improvedCv: string;
  /** Missing keywords added with a quote that really is in the CV. */
  evidence: Record<string, string>;
  /** Added without evidence and taken out again. */
  removed: string[];
  /** Added without evidence and still in the improved CV (in prose we can't safely edit). */
  unverified: string[];
}

// Shorter quotes ("Go", "AWS") prove nothing on their own.
const MIN_QUOTE_LENGTH = 8;
// A live Gemini rewrite quoted one summary sentence as proof of gRPC, GCP,
// Protocol Buffers and logistics. One line rarely proves more than two skills.
const MAX_KEYWORDS_PER_QUOTE = 2;
// Share of a quote's words that must surround the keyword where it was added.
const QUOTE_OVERLAP = 0.6;
const WORD = new RegExp("[\\p{L}\\p{N}+#]{4,}", "gu");
const LIST_LINE = /^(\s*(?:[-*•]\s*)?(?:[^,:|]{1,40}:\s*)?)(.*)$/;
const LIST_SEPARATOR = /\s*[,|;·]\s*/;

function squash(text: string): string {
  return normalizeText(text).replace(/\s+/g, " ").trim();
}

function mentioned(keywords: RequirementKeyword[], text: string): string[] {
  return matchKeywords(keywords, [{ key: "other", heading: "", text }])
    .filter((match) => match.matched)
    .map((match) => match.term);
}

function words(text: string): string[] {
  return squash(text).match(WORD) ?? [];
}

/** The quote names the skill in other words: "Postgres" for PostgreSQL, "gRPC services" for gRPC. */
function quoteNames(keyword: RequirementKeyword, quote: string): boolean {
  const quoted = words(quote);
  return termAliases(keyword).some((alias) => {
    const aliasWords = words(alias);
    return (
      aliasWords.length > 0 &&
      aliasWords.every((word) => quoted.some((candidate) => candidate.startsWith(word.slice(0, Math.max(4, word.length - 3)))))
    );
  });
}

/** The keyword was added to the text the quote comes from, not somewhere else. */
function addedAtQuote(keyword: RequirementKeyword, quote: string, improvedCv: string): boolean {
  const quoted = new Set(words(quote));
  if (quoted.size === 0) return false;
  return improvedCv.split("\n").some((line) => {
    if (mentioned([keyword], line).length === 0) return false;
    const lineWords = new Set(words(line));
    const shared = [...quoted].filter((word) => lineWords.has(word)).length;
    return shared / quoted.size >= QUOTE_OVERLAP;
  });
}

/** Takes a keyword out of comma- or pipe-separated lists like "Skills: Go, Kafka, AWS". */
function dropFromLists(cv: string, keyword: RequirementKeyword): string {
  const aliases = new Set(termAliases(keyword).map((alias) => squash(alias)));
  return cv
    .split("\n")
    .map((line) => {
      // Entry headings and "Employer | City | dates" lines aren't skill lists.
      if (line.startsWith("#") || matchDateRange(line)) return line;
      const [, prefix = "", body = ""] = LIST_LINE.exec(line) ?? [];
      const items = body.split(LIST_SEPARATOR);
      if (items.length < 3) return line;
      const kept = items.filter((item) => !aliases.has(squash(item)));
      return kept.length === items.length ? line : prefix + kept.join(", ");
    })
    .join("\n");
}

/**
 * The rewrite may only add a missing keyword when it quotes CV text that
 * proves it. A quote counts if it really is in the CV and either names the
 * skill or is the text the skill was added to; a skill appended to a list
 * with an unrelated quote doesn't. Anything unproven is reverted, dropped
 * from skill lists, or, if it is still in the text, reported so it isn't
 * scored.
 */
export function verifyRewrite(
  rewrite: Pick<RewriteResult, "suggestions" | "improvedCv" | "addedKeywords"> &
    Partial<Pick<RewriteResult, "unaddressedKeywords">>,
  originalCv: string,
  requirements: JobRequirements,
  scoring: ScoreResult
): VerifiedRewrite {
  const missingTerms = new Set(scoring.keywordMatches.filter((match) => !match.matched).map((match) => match.term));
  const missing = requirements.keywords.filter((keyword) => missingTerms.has(keyword.term));
  const cv = squash(originalCv);

  // The model saying it couldn't add a keyword outweighs its own evidence for it.
  const gaveUp = new Set((rewrite.unaddressedKeywords ?? []).map(squash));
  const uses = new Map<string, number>();
  for (const { evidence: quote } of rewrite.addedKeywords) uses.set(squash(quote), (uses.get(squash(quote)) ?? 0) + 1);

  const evidence: Record<string, string> = {};
  for (const { keyword, evidence: quote } of rewrite.addedKeywords) {
    const target = missing.find((item) => squash(item.term) === squash(keyword));
    const squashed = squash(quote);
    if (
      target &&
      !gaveUp.has(squash(target.term)) &&
      squashed.length >= MIN_QUOTE_LENGTH &&
      (uses.get(squashed) ?? 0) <= MAX_KEYWORDS_PER_QUOTE &&
      cv.includes(squashed) &&
      (quoteNames(target, quote) || addedAtQuote(target, quote, rewrite.improvedCv))
    ) {
      evidence[target.term] = quote;
    }
  }

  const removed = new Set<string>();
  let improvedCv = rewrite.improvedCv;
  const suggestions = rewrite.suggestions.filter((suggestion) => {
    const before = new Set(mentioned(missing, suggestion.original));
    const invented = mentioned(missing, suggestion.improved).filter((term) => !before.has(term) && !(term in evidence));
    if (invented.length === 0) return true;
    improvedCv = improvedCv.split(suggestion.improved).join(suggestion.original);
    invented.forEach((term) => removed.add(term));
    return false;
  });

  const unverified: string[] = [];
  for (const keyword of missing) {
    if (keyword.term in evidence || mentioned([keyword], improvedCv).length === 0) continue;
    improvedCv = dropFromLists(improvedCv, keyword);
    if (mentioned([keyword], improvedCv).length > 0) unverified.push(keyword.term);
    else removed.add(keyword.term);
  }

  return {
    suggestions,
    improvedCv,
    evidence,
    removed: [...removed].filter((term) => !unverified.includes(term)),
    unverified,
  };
}
