import type { CvSection, SectionKey } from "./types";

const SECTION_HEADINGS: Record<Exclude<SectionKey, "contact">, string[]> = {
  summary: [
    "professional summary",
    "career summary",
    "executive summary",
    "summary",
    "professional profile",
    "profile",
    "about me",
    "about",
    "career objective",
    "objective",
    "personal statement",
  ],
  experience: [
    "professional experience",
    "work experience",
    "relevant experience",
    "employment history",
    "work history",
    "career history",
    "experience",
    "employment",
  ],
  skills: [
    "technical skills",
    "core competencies",
    "key skills",
    "skills",
    "competencies",
    "expertise",
    "technologies",
    "tech stack",
  ],
  education: [
    "academic background",
    "academic qualifications",
    "education",
    "qualifications",
  ],
  certifications: [
    "licenses and certifications",
    "licenses & certifications",
    "certifications",
    "certificates",
    "licenses",
  ],
  projects: ["personal projects", "key projects", "projects"],
  other: [
    "awards",
    "honors",
    "publications",
    "volunteer experience",
    "volunteering",
    "volunteer",
    "languages",
    "interests",
    "hobbies",
    "references",
  ],
};

// Longest headings first so "work experience" wins over "experience".
const HEADING_LOOKUP: Array<{ key: Exclude<SectionKey, "contact">; heading: string }> =
  (Object.entries(SECTION_HEADINGS) as Array<[Exclude<SectionKey, "contact">, string[]]>)
    .flatMap(([key, headings]) => headings.map((heading) => ({ key, heading })))
    .sort((a, b) => b.heading.length - a.heading.length);

const INLINE_HEADING_KEYS = new Set<SectionKey>(["summary", "skills", "education", "certifications"]);

// What may follow a heading on the same line: "Skills & Tools", "Education / Training".
const HEADING_TAIL = /^(\s*(&|and|\/|,|\|)\s*[a-z ]{0,25})?$/;

/** Lowercase, NFKC, unify dashes and quotes, collapse whitespace. */
export function normalizeText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, "-")
    .toLowerCase()
    .replace(/[ \t]+/g, " ");
}

function stripLineDecoration(line: string): string {
  return line
    .replace(/^\s*#{1,6}\s*/, "")
    .replace(/[*_`]/g, "")
    .replace(/^\s*[•\-–—·▪●■◦]\s*/, "")
    .replace(/[:\s]+$/, "")
    .trim();
}

interface HeadingMatch {
  key: Exclude<SectionKey, "contact">;
  heading: string;
  /** Content on the same line, e.g. "Python, Go" in "Skills: Python, Go". */
  inline: string;
}

/** Returns the section a line introduces, or null if it is not a heading. */
export function detectHeading(line: string): HeadingMatch | null {
  const stripped = stripLineDecoration(line);
  const cleaned = normalizeText(stripped).trim();
  if (cleaned.length === 0) return null;

  for (const { key, heading } of HEADING_LOOKUP) {
    if (!cleaned.startsWith(heading)) continue;
    const tail = cleaned.slice(heading.length);

    if (cleaned.length <= 40 && HEADING_TAIL.test(tail)) {
      return { key, heading: stripped, inline: "" };
    }
    if (/^\s*:\s*\S/.test(tail)) {
      const colon = stripped.indexOf(":");
      return { key, heading: stripped.slice(0, colon).trim(), inline: stripped.slice(colon + 1).trim() };
    }
  }
  return null;
}

/**
 * Split CV text into sections by heading lines. Text before the first heading
 * is the "contact" block (name, email, phone).
 */
export function splitSections(cvText: string): CvSection[] {
  const sections: CvSection[] = [];
  let current: CvSection = { key: "contact", heading: "", text: "" };

  for (const line of cvText.split(/\r?\n/)) {
    const match = detectHeading(line);
    // "Languages: JavaScript, Python" inside a skills list, or "Experience: 5 years"
    // in a summary, is content, not a new section.
    if (match && (!match.inline || INLINE_HEADING_KEYS.has(match.key))) {
      sections.push(current);
      current = { key: match.key, heading: match.heading, text: match.inline ? match.inline + "\n" : "" };
    } else {
      current.text += line + "\n";
    }
  }
  sections.push(current);

  return sections.filter((section) => section.key !== "contact" || section.text.trim().length > 0);
}

/** All text belonging to sections of the given kind, joined. */
export function sectionText(sections: CvSection[], key: SectionKey): string {
  return sections
    .filter((section) => section.key === key)
    .map((section) => section.text)
    .join("\n");
}
