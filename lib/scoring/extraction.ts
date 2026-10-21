/**
 * Signs that turning the file into text went wrong. An ATS stores the same
 * extracted text, so a recruiter searching it sees these problems too.
 * Pure, so the browser can run it on the stored CV text.
 */
export type ExtractionIssueKind = "mixed_case" | "dotted_i" | "spaced_letters" | "unreadable";

export interface ExtractionIssue {
  kind: ExtractionIssueKind;
  count: number;
  /** Up to 5 distinct examples, as they appear in the text. */
  examples: string[];
  /** mixed_case only: every stray lowercase letter is an "i", the Turkish İ signature. */
  onlyLowercaseI?: boolean;
}

// Built with RegExp: the TS target (ES2017) rejects \p{} in regex literals.
export const WORD = new RegExp("[\\p{L}\\p{M}]+", "gu");
const MARK = new RegExp("\\p{M}", "gu");
const UPPER = new RegExp("\\p{Lu}", "u");
const LOWER = new RegExp("\\p{Ll}", "u");
const PLURAL_ACRONYM = new RegExp("\\p{Lu}s$", "u");
// "E X P E R I E N C E": at least four single letters separated by spaces.
const SPACED = new RegExp("(?:^|\\s)((?:\\p{L} ){3,}\\p{L})(?=\\s|$)", "gmu");
const UNREADABLE = /[�-]/g;

// Terms written in mixed case on purpose, which would otherwise look garbled.
const MIXED_CASE_TERMS = new Set(["nosql", "mysql", "mssql", "ebpf", "grpc", "mtls", "curl"]);

/** Lowercase letters stranded in an otherwise uppercase word ("iNTERN"), or null. */
function strayLowercase(word: string): string[] | null {
  const letters = word.replace(MARK, "");
  if (MIXED_CASE_TERMS.has(letters.toLowerCase())) return null;
  // Plural acronyms ("APIs", "LLMs") end in a lowercase s on purpose.
  const chars = [...(PLURAL_ACRONYM.test(letters) ? letters.slice(0, -1) : letters)];
  if (chars.length < 4) return null;

  const lower = chars.filter((char) => LOWER.test(char));
  const upper = chars.filter((char) => UPPER.test(char)).length;
  return lower.length > 0 && upper / chars.length >= 0.7 ? lower : null;
}

function hasDottedI(word: string): boolean {
  return word.includes("İ") || word.includes("̇");
}

/** True for a word the ATS view should highlight. */
export function isFlaggedWord(word: string): boolean {
  return strayLowercase(word) !== null || hasDottedI(word);
}

function distinct(values: string[], limit = 5): string[] {
  return [...new Set(values)].slice(0, limit);
}

export function findExtractionIssues(text: string): ExtractionIssue[] {
  const issues: ExtractionIssue[] = [];
  const words = text.match(WORD) ?? [];

  const garbled: string[] = [];
  const strayLetters: string[] = [];
  for (const word of words) {
    const lower = strayLowercase(word);
    if (lower) {
      garbled.push(word);
      strayLetters.push(...lower);
    }
  }
  if (garbled.length > 0) {
    issues.push({
      kind: "mixed_case",
      count: garbled.length,
      examples: distinct(garbled),
      onlyLowercaseI: strayLetters.every((letter) => letter === "i" || letter === "ı"),
    });
  }

  // Capital İ or a combining dot: ATS software lowercases these to "i̇",
  // which no longer matches the plain "i" in headings and keywords.
  // Words already reported as mixed case aren't repeated here.
  const dotted = words.filter((word) => hasDottedI(word) && strayLowercase(word) === null);
  if (dotted.length > 0) {
    issues.push({ kind: "dotted_i", count: dotted.length, examples: distinct(dotted) });
  }

  const spaced = [...text.matchAll(SPACED)].map((match) => match[1]);
  if (spaced.length > 0) {
    issues.push({ kind: "spaced_letters", count: spaced.length, examples: distinct(spaced) });
  }

  const unreadable = text.match(UNREADABLE) ?? [];
  if (unreadable.length > 0) {
    issues.push({ kind: "unreadable", count: unreadable.length, examples: [] });
  }

  return issues;
}
