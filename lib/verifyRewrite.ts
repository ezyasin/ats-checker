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

/** Takes a keyword out of comma- or pipe-separated lists like "Skills: Go, Kafka, AWS". */
function dropFromLists(cv: string, keyword: RequirementKeyword): string {
  const aliases = new Set(termAliases(keyword).map((alias) => squash(alias)));
  return cv
    .split("\n")
    .map((line) => {
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
 * proves it. Quotes are checked against the original CV here; anything
 * unproven is reverted, dropped from skill lists, or, if it is still in the
 * text, reported so it isn't scored.
 */
export function verifyRewrite(
  rewrite: Pick<RewriteResult, "suggestions" | "improvedCv" | "addedKeywords">,
  originalCv: string,
  requirements: JobRequirements,
  scoring: ScoreResult
): VerifiedRewrite {
  const missingTerms = new Set(scoring.keywordMatches.filter((match) => !match.matched).map((match) => match.term));
  const missing = requirements.keywords.filter((keyword) => missingTerms.has(keyword.term));
  const cv = squash(originalCv);

  const evidence: Record<string, string> = {};
  for (const { keyword, evidence: quote } of rewrite.addedKeywords) {
    const target = missing.find((item) => squash(item.term) === squash(keyword));
    const squashed = squash(quote);
    if (target && squashed.length >= MIN_QUOTE_LENGTH && cv.includes(squashed)) {
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
