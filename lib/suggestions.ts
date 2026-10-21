import { findDateRanges } from "@/lib/scoring/experience";
import { matchKeywords } from "@/lib/scoring/keywords";
import { detectHeading } from "@/lib/scoring/sections";
import type { JobRequirements, ScoreResult } from "@/lib/scoring/types";
import type { RewriteSuggestion, Suggestion } from "@/types/analysis";

const ORDER: Record<Suggestion["priority"], number> = { critical: 0, important: 1, optional: 2 };

// Structure checks a suggestion can fix by introducing that section's heading.
const SECTION_CHECKS = new Set(["experience", "education", "skills"]);

function hasHeading(text: string, key: string): boolean {
  return text.split("\n").some((line) => detectHeading(line)?.key === key);
}

function fixesCheck(id: string, suggestion: RewriteSuggestion): boolean {
  if (SECTION_CHECKS.has(id)) {
    return hasHeading(suggestion.improved, id) && !hasHeading(suggestion.original, id);
  }
  if (id === "dates") {
    return findDateRanges(suggestion.improved).length > 0 && findDateRanges(suggestion.original).length === 0;
  }
  return false;
}

/**
 * Ranks rewrites by what the scoring engine can verify, not by the model's
 * opinion:
 * - critical: adds a required keyword the CV was missing
 * - important: adds a missing preferred keyword, or fixes a failed structure check
 * - optional: anything else (wording, formatting)
 * Pure, so the browser can re-rank after the user edits the requirements.
 */
export function prioritizeSuggestions(
  suggestions: RewriteSuggestion[],
  requirements: JobRequirements,
  scoring: ScoreResult
): Suggestion[] {
  const missingTerms = new Set(scoring.keywordMatches.filter((match) => !match.matched).map((match) => match.term));
  const missing = requirements.keywords.filter((keyword) => missingTerms.has(keyword.term));
  const failedChecks =
    scoring.components.find((component) => component.key === "structure")?.checks.filter((check) => !check.passed) ??
    [];

  const found = (text: string) =>
    matchKeywords(missing, [{ key: "other", heading: "", text }]).filter((match) => match.matched);

  return suggestions
    .map(({ section, original, improved, reason }): Suggestion => {
      const before = new Set(found(original).map((match) => match.term));
      const added = found(improved).filter((match) => !before.has(match.term));
      const fixes = failedChecks
        .filter((check) => fixesCheck(check.id, { section, original, improved, reason }))
        .map((check) => check.label);

      const priority = added.some((match) => match.importance === "required")
        ? "critical"
        : added.length > 0 || fixes.length > 0
          ? "important"
          : "optional";

      return { section, original, improved, reason, priority, adds: added.map((match) => match.term), fixes };
    })
    .sort((a, b) => ORDER[a.priority] - ORDER[b.priority]);
}
