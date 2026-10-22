import type { ScoreResult } from "./scoring";
import { findExtractionIssues } from "./scoring/extraction";

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
  required: ["suggestions", "improvedCv", "addedKeywords", "unaddressedKeywords"],
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["section", "original", "improved", "reason"],
        properties: {
          section: { type: "string" },
          original: { type: "string" },
          improved: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
    improvedCv: { type: "string" },
    addedKeywords: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["keyword", "evidence"],
        properties: {
          keyword: { type: "string" },
          evidence: { type: "string" },
        },
      },
    },
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
  const garbled = findExtractionIssues(cvText).find((issue) => issue.kind === "mixed_case");
  const extractionNote = garbled
    ? `\n6. The CV text was extracted from a file, and odd capitalisation such as ${garbled.examples
        .map((word) => `"${word}"`)
        .join(", ")} comes from that extraction, not from the candidate. Write those words normally in improvedCv, but don't make suggestions about them or call them typos.`
    : "";

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
1. Add a missing keyword only where the CV already gives evidence for it, e.g. the CV says "Postgres" and the job says "PostgreSQL", or a described task clearly is that skill. Do not upgrade claims: "fixed accessibility issues" does not become "ensured WCAG compliance". List every missing keyword you could not add honestly in unaddressedKeywords. Never add placeholders, bracketed notes or "simulated" skills: if there is no evidence, leave the skill out.
   For every missing keyword you do add, put it in addedKeywords with "evidence": a short quote copied word for word from the CV that shows the candidate has it. A program checks each quote against the CV and removes any keyword whose quote isn't found.
2. Never change the candidate's job titles or seniority, including in the summary: a "Frontend Developer" stays a "Frontend Developer" even when applying for a "Senior Frontend Engineer" role. Describe the candidate's real experience in the summary instead.
3. suggestions: 3 to 8 targeted rewrites, most impactful first. "original" must be copied verbatim from the CV; "improved" is the replacement; "reason" explains the ATS benefit in one sentence. Prefer changes that honestly add a missing keyword or fix a failed structure check. Don't suggest reformatting dates unless "Parseable dates" failed: the engine already reads formats like "Sep. 2024".
4. improvedCv: the complete CV in markdown, applying all of your suggestions.
   - First line "# <Full Name>", then one line with the contact details from the CV (email, phone, location, links).
   - Standard "## " headings: Summary, Experience, Skills, Education, then Certifications, Projects or others the CV already has.
   - Keep every role, employer, date and degree from the original. Write role dates as "Mon YYYY – Mon YYYY" or "Mon YYYY – Present".
   - Bullet points start with "- ".
5. Write in the same language as the CV.${extractionNote}`;
}

export const COVER_LETTER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["letter"],
  properties: { letter: { type: "string" } },
} as const;

export const COVER_LETTER_SYSTEM = `You write cover letters for job applications using only facts stated in the candidate's CV. You never invent employers, titles, dates, numbers, skills or motivations the CV doesn't support. A specific, honest letter beats an impressive-sounding one.`;

export function buildCoverLetterPrompt(cvText: string, jobDescription: string, score: ScoreResult): string {
  const shown = score.keywordMatches.filter((match) => match.matched).map((match) => match.term);
  const notShown = score.keywordMatches.filter((match) => !match.matched).map((match) => match.term);

  return `Write a cover letter for this candidate and job.

<job_post>
${jobDescription}
</job_post>

<cv>
${cvText}
</cv>

Skills from the job post that the CV shows: ${shown.length > 0 ? shown.join(", ") : "none"}.
Skills from the job post that the CV does not show, which you must not claim: ${notShown.length > 0 ? notShown.join(", ") : "none"}.

Instructions:
1. 250 to 350 words in 3 or 4 paragraphs. Plain text: no markdown, no bullet points, no subject line.
2. Open with the role, by its title in the job post, and one concrete reason the candidate fits, taken from the CV.
3. In the middle, connect two or three specific achievements from the CV to what the job asks for. Use numbers only where the CV states them.
4. Use the company's name if the post gives it. Never write placeholders such as [Company] or [Hiring Manager].
5. Start with "Dear Hiring Manager," unless the post names a contact person, and end with "Sincerely," followed by the candidate's name from the CV.
6. Don't mention missing skills, apologise for gaps, or claim experience the CV doesn't show. Don't invent reasons for wanting the job beyond what the post says about the role.
7. Write in the language of the job post.`;
}
