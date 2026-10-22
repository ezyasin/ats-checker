import type { DegreeLevel } from "./types";
import { normalizeText } from "./sections";

export const DEGREE_RANK: Record<DegreeLevel, number> = {
  none: 0,
  high_school: 1,
  associate: 2,
  bachelor: 3,
  master: 4,
  doctorate: 5,
};

export const DEGREE_LABEL: Record<DegreeLevel, string> = {
  none: "No degree",
  high_school: "High school",
  associate: "Associate degree",
  bachelor: "Bachelor's degree",
  master: "Master's degree",
  doctorate: "Doctorate",
};

// Highest level first. Abbreviations like "BS"/"MA" only count when followed
// by "in"/"of" so ordinary words and initials don't match.
const DEGREE_PATTERNS: Array<[DegreeLevel, RegExp[]]> = [
  ["doctorate", [/\bph\.?\s?d\b/i, /\bdoctorate\b/i, /\bdoctor of\b/i, /\bd\.phil\b/i]],
  ["master", [
    // Not a bare "master": "Certified Scrum Master" is not a degree.
    /\bmaster'?s?\s+(?:degree|of|in)\b/i,
    /\bm\.?sc\b/i,
    /\bmba\b/i,
    /\bm\.?eng\b/i,
    /\bm\.?tech\b/i,
    /\b(?:m\.s\.|m\.a\.|ms|ma)\s+(?:in|of)\b/i,
  ]],
  ["bachelor", [
    /\bbachelor'?s?\b/i,
    /\bb\.?sc\b/i,
    /\bb\.?eng\b/i,
    /\bb\.?tech\b/i,
    /\bbba\b/i,
    /\bundergraduate degree\b/i,
    /\b(?:b\.s\.|b\.a\.|bs|ba)\s+(?:in|of)\b/i,
  ]],
  ["associate", [/\bassociate'?s? degree\b/i, /\bassociate of\b/i]],
  ["high_school", [/\bhigh school\b/i, /\bsecondary school\b/i, /\bged\b/i]],
];

export function detectDegree(text: string): DegreeLevel {
  const normalized = normalizeText(text);
  for (const [level, patterns] of DEGREE_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(normalized))) return level;
  }
  return "none";
}

/** 100 when the CV meets the minimum, partial credit one level below. */
export function educationScore(detected: DegreeLevel, required: DegreeLevel): number {
  if (required === "none") return 100;
  if (detected === "none") return 0;
  const gap = DEGREE_RANK[required] - DEGREE_RANK[detected];
  if (gap <= 0) return 100;
  if (gap === 1) return 60;
  return 25;
}
