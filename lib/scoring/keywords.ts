import { normalizeText } from "./sections";
import type { CvSection, KeywordMatch, RequirementKeyword } from "./types";

/**
 * Common aliases the LLM may not list. Each group is treated as equivalent.
 * Short entries (2 chars or fewer) are matched case-sensitively, so keep their
 * conventional casing here.
 */
const SYNONYM_GROUPS: string[][] = [
  ["JavaScript", "JS", "ECMAScript"],
  ["TypeScript", "TS"],
  ["Kubernetes", "k8s"],
  ["PostgreSQL", "Postgres"],
  ["Amazon Web Services", "AWS"],
  ["Google Cloud Platform", "Google Cloud", "GCP"],
  ["Microsoft Azure", "Azure"],
  ["Machine Learning", "ML"],
  ["Artificial Intelligence", "AI"],
  ["Large Language Models", "Large Language Model", "LLM", "LLMs"],
  ["Natural Language Processing", "NLP"],
  ["CI/CD", "CICD", "Continuous Integration", "Continuous Delivery", "Continuous Deployment"],
  ["React", "React.js", "ReactJS"],
  ["Node.js", "NodeJS", "Node"],
  ["Vue", "Vue.js", "VueJS"],
  ["Next.js", "NextJS"],
  ["C#", "CSharp"],
  [".NET", "dotnet"],
  ["Go", "Golang"],
  ["User Experience", "UX"],
  ["User Interface", "UI"],
  ["Search Engine Optimization", "SEO"],
  ["REST API", "RESTful API", "REST APIs", "RESTful"],
  ["Amazon S3", "S3"],
  ["Google Analytics", "GA4"],
  ["Customer Relationship Management", "CRM"],
  ["Key Performance Indicators", "KPI", "KPIs"],
  ["Object-Oriented Programming", "OOP"],
  ["Test-Driven Development", "TDD"],
  ["Search Engine Marketing", "SEM"],
  ["Server-Side Rendering", "SSR"],
  ["Accessibility", "Web Accessibility", "a11y"],
];

// "GraphQL APIs" should match a CV that says "GraphQL": these trailing words add
// nothing a recruiter would search for, so the term also matches without them.
const GENERIC_SUFFIXES = new Set([
  "api", "apis", "development", "programming", "framework", "frameworks",
  "language", "languages", "platform", "services", "experience", "skills",
]);
const TOO_GENERIC_ALONE = new Set(["web", "software", "data", "cloud", "mobile", "backend", "frontend", "api"]);

function withoutGenericSuffix(term: string): string | null {
  const words = term.trim().split(/\s+/);
  if (words.length < 2 || !GENERIC_SUFFIXES.has(normalizeText(words[words.length - 1]))) return null;
  const core = words.slice(0, -1).join(" ");
  const normalizedCore = normalizeText(core);
  if (normalizedCore.length < 3 || TOO_GENERIC_ALONE.has(normalizedCore)) return null;
  return core;
}

const SYNONYM_INDEX = new Map<string, string[]>();
for (const group of SYNONYM_GROUPS) {
  for (const entry of group) {
    SYNONYM_INDEX.set(normalizeText(entry), group);
  }
}

const SHORT_TERM_LENGTH = 2;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** "Node.js" -> ["node.js", "nodejs", "node js"]; "front-end" -> ["front-end", "frontend", "front end"]. */
function spellingVariants(term: string): string[] {
  const base = normalizeText(term).trim();
  const variants = new Set([base]);
  if (/[.\- ]/.test(base.slice(1))) {
    const head = base[0];
    const tail = base.slice(1);
    variants.add(head + tail.replace(/[.\- ]/g, ""));
    variants.add(head + tail.replace(/[.\-]/g, " ").replace(/\s+/g, " "));
    variants.add(head + tail.replace(/[ ]/g, "-"));
  }
  return [...variants].filter((variant) => variant.length > 0);
}

interface Matcher {
  label: string;
  regex: RegExp;
  caseSensitive: boolean;
}

function buildMatcher(label: string): Matcher[] {
  const trimmed = label.trim();
  if (trimmed.length <= SHORT_TERM_LENGTH) {
    // "Go", "R", "C", "UI": match exact casing on the raw text so "go to market" doesn't count.
    return [{
      label: trimmed,
      regex: new RegExp(`(?<![\\p{L}\\p{N}+#])${escapeRegExp(trimmed)}(?![\\p{L}\\p{N}+#])`, "gu"),
      caseSensitive: true,
    }];
  }

  return spellingVariants(trimmed).map((variant) => {
    // Allow simple plurals for terms that end in a letter: "API" -> "APIs".
    const plural = /\p{L}$/u.test(variant) ? "(?:s|es)?" : "";
    return {
      label: trimmed,
      regex: new RegExp(
        `(?<![\\p{L}\\p{N}+#])${escapeRegExp(variant)}${plural}(?![\\p{L}\\p{N}+#])`,
        "gu"
      ),
      caseSensitive: false,
    };
  });
}

/** The term, its LLM-provided synonyms and any built-in aliases, deduplicated. */
export function termAliases(keyword: Pick<RequirementKeyword, "term" | "synonyms">): string[] {
  const aliases = new Map<string, string>();
  const add = (value: string) => {
    const key = normalizeText(value).trim();
    if (key && !aliases.has(key)) aliases.set(key, value.trim());
  };

  add(keyword.term);
  keyword.synonyms.forEach(add);
  const core = withoutGenericSuffix(keyword.term);
  if (core) add(core);
  for (const value of [...aliases.keys()]) {
    SYNONYM_INDEX.get(value)?.forEach(add);
  }
  return [...aliases.values()];
}

function countMatches(matchers: Matcher[], rawText: string, normalizedText: string) {
  let occurrences = 0;
  let matchedAs: string | undefined;

  for (const matcher of matchers) {
    const haystack = matcher.caseSensitive ? rawText : normalizedText;
    const found = haystack.match(matcher.regex)?.length ?? 0;
    if (found > 0) {
      occurrences += found;
      matchedAs ??= matcher.label;
    }
  }
  return { occurrences, matchedAs };
}

export function matchKeywords(
  keywords: RequirementKeyword[],
  sections: CvSection[]
): KeywordMatch[] {
  const prepared = sections.map((section) => ({
    key: section.key,
    raw: section.text,
    normalized: normalizeText(section.text),
  }));

  return keywords.map((keyword) => {
    const aliases = termAliases(keyword);
    const matchers = aliases.flatMap(buildMatcher);

    let occurrences = 0;
    let matchedAs: string | undefined;
    const foundIn = new Set<CvSection["key"]>();

    for (const section of prepared) {
      const result = countMatches(matchers, section.raw, section.normalized);
      if (result.occurrences > 0) {
        occurrences += result.occurrences;
        matchedAs ??= result.matchedAs;
        foundIn.add(section.key);
      }
    }

    const sameAsTerm = matchedAs && normalizeText(matchedAs) === normalizeText(keyword.term);
    return {
      term: keyword.term,
      category: keyword.category,
      importance: keyword.importance,
      matched: occurrences > 0,
      matchedAs: sameAsTerm ? undefined : matchedAs,
      occurrences,
      sections: [...foundIn],
    };
  });
}

const IMPORTANCE_WEIGHT = { required: 3, preferred: 1 } as const;
const CATEGORY_WEIGHT = {
  hard_skill: 1,
  tool: 1,
  certification: 1,
  domain: 0.75,
  soft_skill: 0.5,
} as const;

export function keywordWeight(match: Pick<KeywordMatch, "importance" | "category">): number {
  return IMPORTANCE_WEIGHT[match.importance] * CATEGORY_WEIGHT[match.category];
}

/** Weighted share of keywords found, 0-100. */
export function keywordCoverage(matches: KeywordMatch[]): number {
  const total = matches.reduce((sum, match) => sum + keywordWeight(match), 0);
  if (total === 0) return 100;
  const found = matches
    .filter((match) => match.matched)
    .reduce((sum, match) => sum + keywordWeight(match), 0);
  return Math.round((found / total) * 100);
}
