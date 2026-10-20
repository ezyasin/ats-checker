import type { ScoreResult } from "./scoring";

const KEYWORD_CATEGORIES = ["hard_skill", "tool", "soft_skill", "certification", "domain"];
const DEGREE_LEVELS = ["none", "high_school", "associate", "bachelor", "master", "doctorate"];

export const REQUIREMENTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["jobTitle", "titleAliases", "keywords", "minYearsExperience", "minDegree"],
  properties: {
    jobTitle: { type: "string" },
    titleAliases: { type: "array", items: { type: "string" } },
    keywords: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["term", "synonyms", "category", "importance"],
        properties: {
          term: { type: "string" },
          synonyms: { type: "array", items: { type: "string" } },
          category: { type: "string", enum: KEYWORD_CATEGORIES },
          importance: { type: "string", enum: ["required", "preferred"] },
        },
      },
    },
    minYearsExperience: { type: "integer" },
    minDegree: { type: "string", enum: DEGREE_LEVELS },
  },
} as const;

export const REWRITE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["suggestions", "improvedCv", "unaddressedKeywords"],
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["priority", "section", "original", "improved", "reason"],
        properties: {
          priority: { type: "string", enum: ["critical", "important", "optional"] },
          section: { type: "string" },
          original: { type: "string" },
          improved: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
    improvedCv: { type: "string" },
    unaddressedKeywords: { type: "array", items: { type: "string" } },
  },
} as const;

export const REQUIREMENTS_SYSTEM = `You extract hiring requirements from job posts for an ATS (applicant tracking system) matcher. A program, not a person, will search CVs for the keywords you return, so precision matters more than coverage. Extract only what the job post states; never infer requirements it does not mention.`;

export function buildRequirementsPrompt(jobDescription: string): string {
  return `Extract the requirements from the job post below.

<job_post>
${jobDescription}
</job_post>

Rules:
- jobTitle: the title as written in the post, without company name or location.
- titleAliases: up to 4 common alternative titles for the same role (e.g. "Frontend Developer" for "Front-End Engineer").
- keywords: 8 to 25 specific, searchable skills, tools, technologies, certifications and domain terms, in the order the post emphasises them.
  - term: the shortest form a recruiter would search for, spelled as in the post: "GraphQL" not "GraphQL APIs", "accessibility" not "strong understanding of web accessibility", "React" not "React development".
  - One concept per keyword: split "React and TypeScript" into two keywords; keep a standard and its topic separate ("accessibility" and "WCAG").
  - synonyms: only true equivalents or abbreviations ("Postgres" for "PostgreSQL"); usually empty.
  - category: hard_skill (methods, languages), tool (products, frameworks, platforms), certification, domain (industry or field knowledge), soft_skill.
  - importance: "required" if listed as a requirement or must-have; "preferred" if a nice-to-have, plus or bonus. If the post does not separate them, use "required".
  - Include soft skills only if the post names them explicitly. Never include generic words like "experience", "team", "software", "skills", "work".
- minYearsExperience: the smallest number of years of experience the post requires ("3-5 years" is 3, "5+ years" is 5). Use 0 if it states none.
- minDegree: the minimum degree the post requires. Use "none" if no degree is required or "equivalent experience" is accepted instead.`;
}

export const REWRITE_SYSTEM = `You are an expert CV writer who optimises CVs for ATS (applicant tracking system) searches without misrepresenting the candidate. You never invent employers, job titles, dates, degrees, certifications, metrics or skills. A rewrite that claims experience the candidate does not have can cost them the job, so honesty overrides keyword coverage.`;

export function buildRewritePrompt(cvText: string, jobDescription: string, score: ScoreResult): string {
  const missing = score.keywordMatches
    .filter((match) => !match.matched)
    .sort((a, b) => (a.importance === b.importance ? 0 : a.importance === "required" ? -1 : 1))
    .map((match) => `- ${match.term} (${match.importance})`);
  const failedChecks = score.components
    .flatMap((component) => component.checks)
    .filter((check) => !check.passed)
    .map((check) => `- ${check.label}: ${check.detail}`);
  const summaries = score.components.map(
    (component) => `- ${component.label}: ${component.score}/100. ${component.summary}`
  );

  return `Improve this CV for the job post below.

<job_post>
${jobDescription}
</job_post>

<cv>
${cvText}
</cv>

An ATS scoring engine measured the CV at ${score.total}/100:
${summaries.join("\n")}

Keywords from the job post that the CV does not contain:
${missing.length > 0 ? missing.join("\n") : "- none"}

Failed structure checks:
${failedChecks.length > 0 ? failedChecks.join("\n") : "- none"}

Instructions:
1. Add a missing keyword only where the CV already gives evidence for it, e.g. the CV says "Postgres" and the job says "PostgreSQL", or a described task clearly is that skill. Do not upgrade claims: "fixed accessibility issues" does not become "ensured WCAG compliance". List every missing keyword you could not add honestly in unaddressedKeywords.
2. Never change the candidate's job titles or seniority, including in the summary: a "Frontend Developer" stays a "Frontend Developer" even when applying for a "Senior Frontend Engineer" role. Describe the candidate's real experience in the summary instead.
3. suggestions: 3 to 8 targeted rewrites, most impactful first. "original" must be copied verbatim from the CV; "improved" is the replacement; "reason" explains the ATS benefit in one sentence. Use priority "critical" for missing required keywords and structure problems.
4. improvedCv: the complete CV in markdown, applying all of your suggestions.
   - First line "# <Full Name>", then one line with the contact details from the CV (email, phone, location, links).
   - Standard "## " headings: Summary, Experience, Skills, Education, then Certifications, Projects or others the CV already has.
   - Keep every role, employer, date and degree from the original. Write role dates as "Mon YYYY – Mon YYYY" or "Mon YYYY – Present".
   - Bullet points start with "- ".
5. Write in the same language as the CV.`;
}
