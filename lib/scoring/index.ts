import { DEGREE_LABEL, detectDegree, educationScore } from "./education";
import { findDateRanges, totalYears } from "./experience";
import { keywordCoverage, matchKeywords } from "./keywords";
import { normalizeText, sectionText, splitSections } from "./sections";
import type {
  ComponentKey,
  CvSection,
  DegreeLevel,
  JobRequirements,
  KeywordMatch,
  ScoreCheck,
  ScoreComponent,
  ScoreResult,
  SectionScores,
  Verdict,
} from "./types";

export type * from "./types";

export const COMPONENT_WEIGHTS: Record<ComponentKey, number> = {
  keywords: 45,
  structure: 20,
  experience: 15,
  title: 10,
  education: 10,
};

const TITLE_FILLER = new Set([
  "senior", "sr", "junior", "jr", "lead", "principal", "staff", "head", "chief",
  "associate", "assistant", "i", "ii", "iii", "iv", "of", "and", "the", "for",
]);

// Role nouns recruiters use interchangeably.
const ROLE_NOUNS: Record<string, string> = {
  developer: "engineer",
  programmer: "engineer",
  engineer: "engineer",
};

/** "Sr. Front-End Developer" -> ["frontend", "engineer"]. */
export function titleTokens(text: string): string[] {
  return normalizeText(text)
    .replace(/(\p{L})-(\p{L})/gu, "$1$2")
    .replace(/\b(front|back) end\b/g, "$1end")
    .replace(/\bfull stack\b/g, "fullstack")
    .split(/[^\p{L}\p{N}+#.]+/u)
    .map((token) => token.replace(/\.$/, ""))
    .filter((token) => token.length > 1 && !TITLE_FILLER.has(token))
    .map((token) => ROLE_NOUNS[token] ?? token);
}

export function verdictFor(score: number): Verdict {
  if (score <= 30) return "Poor";
  if (score <= 60) return "Fair";
  if (score <= 80) return "Good";
  return "Excellent";
}

function component(
  key: ComponentKey,
  label: string,
  score: number,
  summary: string,
  checks: ScoreCheck[] = []
): ScoreComponent {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const weight = COMPONENT_WEIGHTS[key];
  return {
    key,
    label,
    score: clamped,
    weight,
    points: Math.round(clamped * weight) / 100,
    summary,
    checks,
  };
}

function scoreKeywords(matches: KeywordMatch[]): ScoreComponent {
  if (matches.length === 0) {
    return component("keywords", "Keyword match", 100, "No keywords were extracted from the job post.");
  }
  const required = matches.filter((match) => match.importance === "required");
  const found = matches.filter((match) => match.matched).length;
  const requiredFound = required.filter((match) => match.matched).length;
  const missingRequired = required.filter((match) => !match.matched).map((match) => match.term);

  const summary =
    `Found ${found} of ${matches.length} keywords (${requiredFound} of ${required.length} required).` +
    (missingRequired.length > 0 ? ` Missing required: ${missingRequired.join(", ")}.` : "");
  return component("keywords", "Keyword match", keywordCoverage(matches), summary);
}

function scoreTitle(cvText: string, sections: CvSection[], requirements: JobRequirements): ScoreComponent {
  const title = requirements.jobTitle.trim();
  if (!title) {
    return component("title", "Job title", 100, "The job post has no clear title.");
  }

  const exact = matchKeywords(
    [{ term: title, synonyms: [], category: "domain", importance: "required" }],
    sections
  )[0];
  if (exact.matched) {
    return component("title", "Job title", 100, `Your CV uses the exact job title "${title}".`);
  }

  // A close match ignores seniority and treats developer/engineer as the same,
  // so the score doesn't depend on which aliases the LLM happened to list.
  const variants = [title, ...requirements.titleAliases]
    .map((variant) => ({ variant, tokens: titleTokens(variant) }))
    .filter((variant) => variant.tokens.length > 0);
  const closeLine = cvText.split(/\r?\n/).find((line) => {
    const lineTokens = new Set(titleTokens(line));
    return variants.some((variant) => variant.tokens.every((token) => lineTokens.has(token)));
  });
  if (closeLine) {
    return component(
      "title",
      "Job title",
      85,
      `Your CV has "${closeLine.trim().slice(0, 80)}", a close match for "${title}". Using the exact title can help ATS searches.`
    );
  }

  const tokens = titleTokens(title);
  if (tokens.length === 0) {
    return component("title", "Job title", 0, `Your CV doesn't mention "${title}".`);
  }
  const cvTokens = new Set(titleTokens(cvText));
  const present = tokens.filter((token) => cvTokens.has(token));
  const summary =
    present.length > 0
      ? `Your CV doesn't use the title "${title}" or a close variant, but mentions ${present.map((token) => `"${token}"`).join(", ")}.`
      : `Your CV doesn't mention "${title}" or any part of it.`;
  return component("title", "Job title", (present.length / tokens.length) * 60, summary);
}

function experienceSource(cvText: string, sections: CvSection[]): string {
  const experience = sectionText(sections, "experience");
  if (experience.trim()) return experience;
  // No experience heading: use everything except education, whose dates aren't work.
  return sections
    .filter((section) => section.key !== "education")
    .map((section) => section.text)
    .join("\n") || cvText;
}

function scoreExperience(years: number, rangesFound: number, minimum: number): ScoreComponent {
  const found =
    rangesFound > 0
      ? `${years} year${years === 1 ? "" : "s"} of experience found across ${rangesFound} dated role${rangesFound === 1 ? "" : "s"}.`
      : "No date ranges like \"Jan 2020 – Present\" were found, so an ATS can't calculate your experience.";

  if (minimum <= 0) {
    return component("experience", "Years of experience", 100, `The job post states no minimum. ${found}`);
  }
  const score = Math.min(1, years / minimum) * 100;
  return component("experience", "Years of experience", score, `The job asks for ${minimum}+ years. ${found}`);
}

function scoreEducation(sections: CvSection[], cvText: string, requirements: JobRequirements) {
  const educationText = sectionText(sections, "education");
  const detected = detectDegree(educationText.trim() ? educationText : cvText);
  const score = educationScore(detected, requirements.minDegree);

  const found = detected === "none" ? "No degree was found in your CV." : `Found: ${DEGREE_LABEL[detected]}.`;
  const summary =
    requirements.minDegree === "none"
      ? `The job post doesn't require a degree. ${found}`
      : `The job asks for a ${DEGREE_LABEL[requirements.minDegree].toLowerCase()} or higher. ${found}`;
  return { detected, component: component("education", "Education", score, summary) };
}

function hasPhone(text: string): boolean {
  for (const candidate of text.match(/\+?\(?\d[\d\s().-]{7,}\d/g) ?? []) {
    const digits = candidate.replace(/\D/g, "").length;
    const looksLikeDates = /(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}/.test(candidate);
    if (digits >= 9 && digits <= 15 && !looksLikeDates) return true;
  }
  return false;
}

const STRUCTURE_POINTS = {
  email: 15,
  phone: 10,
  experience: 20,
  education: 15,
  skills: 15,
  dates: 10,
  length: 10,
  glyphs: 5,
} as const;

function scoreStructure(cvText: string, sections: CvSection[], rangesFound: number): ScoreComponent {
  const present = new Set(sections.map((section) => section.key));
  const words = cvText.split(/\s+/).filter(Boolean).length;
  const unreadable = (cvText.match(/[�-]/g) ?? []).length;

  const checks: Array<ScoreCheck & { id: keyof typeof STRUCTURE_POINTS }> = [
    {
      id: "email",
      label: "Email address",
      passed: /[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(cvText),
      detail: "Recruiters and ATS profiles need a contact email.",
    },
    {
      id: "phone",
      label: "Phone number",
      passed: hasPhone(cvText),
      detail: "Most ATS forms import a phone number from the CV.",
    },
    {
      id: "experience",
      label: "Experience section",
      passed: present.has("experience"),
      detail: "Use a standard heading such as \"Experience\" or \"Work Experience\".",
    },
    {
      id: "education",
      label: "Education section",
      passed: present.has("education"),
      detail: "Use a standard heading such as \"Education\".",
    },
    {
      id: "skills",
      label: "Skills section",
      passed: present.has("skills"),
      detail: "A \"Skills\" section is where ATS keyword searches look first.",
    },
    {
      id: "dates",
      label: "Parseable dates",
      passed: rangesFound > 0,
      detail: "Write role dates like \"Jan 2020 – Present\" or \"03/2018 – 06/2021\".",
    },
    {
      id: "length",
      label: "Length",
      passed: words >= 150 && words <= 1800,
      detail: `${words} words extracted. Aim for 150–1,800; much less usually means text was lost during parsing.`,
    },
    {
      id: "glyphs",
      label: "Readable characters",
      passed: unreadable <= 3,
      detail:
        unreadable > 3
          ? `${unreadable} unreadable characters (icon fonts or symbols) were found. ATS parsers drop or garble them.`
          : "No icon-font or garbled characters found.",
    },
  ];

  const score = checks.reduce((sum, check) => sum + (check.passed ? STRUCTURE_POINTS[check.id] : 0), 0);
  const failed = checks.filter((check) => !check.passed).length;
  const summary =
    failed === 0 ? "All structure checks passed." : `${failed} of ${checks.length} structure checks failed.`;

  return component(
    "structure",
    "Structure & parsing",
    score,
    summary,
    checks
  );
}

function scoreSections(
  sections: CvSection[],
  matches: KeywordMatch[],
  components: Record<ComponentKey, ScoreComponent>,
  rangesFound: number,
  detectedDegree: DegreeLevel
): SectionScores {
  const present = new Set(sections.map((section) => section.key));
  const technical = matches.filter((match) => match.category !== "soft_skill");
  const inSection = (key: CvSection["key"]) =>
    matches.map((match) => ({ ...match, matched: match.sections.includes(key) }));

  const summaryKeywords = technical.filter((match) => match.sections.includes("summary")).length;
  const summary = present.has("summary")
    ? 40 + (components.title.score === 100 ? 30 : 0) + Math.min(30, summaryKeywords * 10)
    : 0;

  const skillsCoverage = keywordCoverage(inSection("skills").filter((match) => match.category !== "soft_skill"));
  const skills = present.has("skills")
    ? 30 + skillsCoverage * 0.7
    : keywordCoverage(technical) * 0.5;

  const experience = present.has("experience")
    ? 30 + (rangesFound > 0 ? 20 : 0) + keywordCoverage(inSection("experience")) * 0.5
    : 0;

  const education = present.has("education") || detectedDegree !== "none"
    ? components.education.score
    : 0;

  return {
    summary: Math.round(summary),
    skills: Math.round(skills),
    experience: Math.round(experience),
    education: Math.round(education),
  };
}

export interface ScoreOptions {
  /** Reference date for "Present" in date ranges. */
  now?: Date;
  /** Keywords a rewrite added without evidence: present in the text, scored as missing. */
  unverifiedKeywords?: string[];
}

/** Score a CV against job requirements. Pure and deterministic. */
export function scoreCv(
  cvText: string,
  requirements: JobRequirements,
  options: ScoreOptions = {}
): ScoreResult {
  const now = options.now ?? new Date();
  const sections = splitSections(cvText);
  const unverified = new Set(options.unverifiedKeywords ?? []);
  const keywordMatches = matchKeywords(requirements.keywords, sections).map((match) =>
    unverified.has(match.term) && match.matched
      ? { ...match, matched: false, matchedAs: undefined, occurrences: 0, sections: [], unverified: true }
      : match
  );

  const ranges = findDateRanges(experienceSource(cvText, sections), now);
  const yearsOfExperience = totalYears(ranges);
  const education = scoreEducation(sections, cvText, requirements);

  const components: Record<ComponentKey, ScoreComponent> = {
    keywords: scoreKeywords(keywordMatches),
    structure: scoreStructure(cvText, sections, ranges.length),
    experience: scoreExperience(yearsOfExperience, ranges.length, requirements.minYearsExperience),
    title: scoreTitle(cvText, sections, requirements),
    education: education.component,
  };

  const ordered = (Object.keys(COMPONENT_WEIGHTS) as ComponentKey[]).map((key) => components[key]);
  const total = Math.round(
    ordered.reduce((sum, item) => sum + (item.score * item.weight) / 100, 0)
  );

  return {
    total,
    verdict: verdictFor(total),
    components: ordered,
    keywordMatches,
    sectionScores: scoreSections(sections, keywordMatches, components, ranges.length, education.detected),
    detectedSections: [...new Set(sections.map((section) => section.key))],
    yearsOfExperience,
    detectedDegree: education.detected,
  };
}
