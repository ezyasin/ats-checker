/**
 * The improved CV as a document: a header, then sections of paragraphs,
 * list items and entries (a role, degree or project with its dates).
 *
 * The rewrite returns these fields and code does all the formatting, so
 * capitals, dates and layout come out the same every time. The CV travels as
 * canonical markdown (`cvToMarkdown`), which the scorer reads and
 * `parseCv` turns back into this model for the preview and exports.
 */
import { isSingleDate, matchDateRange } from "./scoring/experience";
import { stripIconGlyphs } from "./scoring/extraction";

export interface CvEntry {
  /** Job title, degree, project or certificate name. */
  title: string;
  /** Employer, school or issuer. */
  organization: string;
  location: string;
  /** "Sep 2024 – Mar 2026", "Present" or "". */
  dates: string;
  /** Lines under the heading that aren't bullets. */
  details: string[];
  bullets: string[];
}

export type CvModelBlock =
  | { type: "paragraph"; text: string }
  | { type: "item"; text: string }
  | { type: "entry"; entry: CvEntry };

export interface CvModelSection {
  heading: string;
  blocks: CvModelBlock[];
}

export interface CvModel {
  name: string;
  /** The title line under the name, e.g. "Backend Developer". */
  headline: string;
  contact: string[];
  sections: CvModelSection[];
}

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^[-*•–·▪●■◦]\s+(.*)$/;
const RULE = /^(-{3,}|\*{3,}|_{3,})$/;
const CONTACT_HINT = /@|\+?\d[\d ()-]{6,}\d|https?:|www\.|\.(?:com|io|dev|me|net|org|co)\b|linkedin|github|\|/i;
const SENTENCE = /[.!?]$/;
const COMPANY_SUFFIX = /^(?:inc|ltd|llc|gmbh|co|corp|plc|a\.?ş|s\.?a)\.?$/i;

export function stripMarkers(text: string): string {
  return text.replace(/\*\*(.+?)\*\*|__(.+?)__/g, "$1$2").replace(/\s+/g, " ").trim();
}

/* ---------------------------------------------------------------- casing */

// Built with RegExp: the TS target (ES2017) rejects \p{} in regex literals.
const WORD_TOKEN = new RegExp("[\\p{L}\\p{M}\\p{N}'’]+", "gu");
const LETTER = new RegExp("\\p{L}", "u");
const UPPER = new RegExp("\\p{Lu}", "u");
const LOWER = new RegExp("\\p{Ll}", "u");

// Lowercase inside a title: "Bachelor of Science in Computer Engineering".
const MINOR_WORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with", "ve", "ile"]);
// Short words that are words, not acronyms.
const SHORT_WORDS = new Set([
  "web", "app", "new", "big", "top", "art", "law", "key", "sea", "air", "oil", "gas", "end", "pro", "co",
  "inc", "ltd", "llc", "net", "map", "lab", "hub", "bay", "day", "dev", "ops", "tax", "aid", "car", "job",
]);
// Acronyms longer than three letters.
const LONG_ACRONYMS = new Set(["html", "json", "rest", "saas", "nasa", "unix", "ieee", "gdpr", "hipaa"]);

/** "İ" lowercases to "i" + a combining dot; CVs mean a plain "i". */
function lowerChar(char: string): string {
  return char === "İ" ? "i" : char.toLowerCase();
}

function lowerWord(word: string): string {
  return [...word].map(lowerChar).join("");
}

function upperWord(word: string): string {
  return [...word].map((char) => (char === "ı" ? "I" : char.toUpperCase())).join("");
}

/**
 * Text in capitals, as decorative CV fonts extract it ("BACKEND DEVELOPER").
 * A lowercase "i" among capitals is the Turkish İ extraction signature
 * ("iNTERN"), so it counts as a capital.
 */
function isShouting(text: string): boolean {
  const letters = [...text].filter((char) => LETTER.test(char));
  if (letters.length < 4) return false;
  return letters.every((char) => !LOWER.test(char) || char === "i" || char === "ı") && letters.some((char) => UPPER.test(char));
}

/**
 * Words the CV writes with capitals inside them ("PostgreSQL", "AWS",
 * "iOS"), so recasing a heading keeps them as the candidate spells them.
 */
export function casingVocabulary(text: string): Map<string, string> {
  const vocabulary = new Map<string, string>();
  for (const line of text.split("\n")) {
    if (isShouting(line)) continue;
    for (const word of line.match(WORD_TOKEN) ?? []) {
      const chars = [...word];
      if (!chars.slice(1).some((char) => UPPER.test(char))) continue;
      const lower = chars.filter((char) => LOWER.test(char));
      // Mixed case ("PostgreSQL"), or a short acronym ("AWS"). Long words in
      // capitals are headings, and "iNTERN" is an extraction error.
      const mixed = lower.length > 0 && !lower.every((char) => char === "i" || char === "ı");
      if (mixed || (lower.length === 0 && chars.length <= 5)) vocabulary.set(lowerWord(word), word);
    }
  }
  return vocabulary;
}

/** "BACKEND DEVELOPER INTERN" -> "Backend Developer Intern"; text in normal case is left alone. */
export function recase(text: string, vocabulary: Map<string, string> = new Map()): string {
  if (!isShouting(text)) return text;
  let first = true;
  return text.replace(WORD_TOKEN, (word) => {
    const isFirst = first;
    first = false;
    const lower = lowerWord(word);
    if (!isFirst && MINOR_WORDS.has(lower)) return lower;
    const known = vocabulary.get(lower);
    if (known) return known;
    if (/\d/.test(word)) return upperWord(word);
    const letters = [...lower].filter((char) => LETTER.test(char)).length;
    if (LONG_ACRONYMS.has(lower) || (letters <= 3 && !SHORT_WORDS.has(lower) && !MINOR_WORDS.has(lower))) {
      return upperWord(word);
    }
    // Keep a capital as typed ("İstanbul"); a stray "i" is a lost "I".
    const [head] = [...word];
    return (UPPER.test(head) ? head : upperWord(head)) + [...lower].slice(1).join("");
  });
}

/* ----------------------------------------------------------------- dates */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_INDEX: Record<string, number> = Object.fromEntries(
  [
    ["jan", "january"], ["feb", "february"], ["mar", "march"], ["apr", "april"], ["may"], ["jun", "june"],
    ["jul", "july"], ["aug", "august"], ["sep", "sept", "september"], ["oct", "october"], ["nov", "november"],
    ["dec", "december"],
  ].flatMap((names, index) => names.map((name) => [name, index]))
);

/** One date as "Sep 2024", "2024" or "Present"; anything else is kept as written. */
export function formatDate(raw: string): string {
  const text = stripMarkers(raw);
  if (/^(present|current|now|today|ongoing|to date)$/i.test(text)) return "Present";

  const named = /^([a-z]+)\.?,?\s+(\d{4})$/i.exec(text);
  if (named && named[1].toLowerCase() in MONTH_INDEX) return `${MONTHS[MONTH_INDEX[named[1].toLowerCase()]]} ${named[2]}`;
  const monthFirst = /^(\d{1,2})[/.](\d{4})$/.exec(text);
  if (monthFirst && Number(monthFirst[1]) >= 1 && Number(monthFirst[1]) <= 12) {
    return `${MONTHS[Number(monthFirst[1]) - 1]} ${monthFirst[2]}`;
  }
  const yearFirst = /^(\d{4})[/.-](\d{1,2})$/.exec(text);
  if (yearFirst && Number(yearFirst[2]) >= 1 && Number(yearFirst[2]) <= 12) {
    return `${MONTHS[Number(yearFirst[2]) - 1]} ${yearFirst[1]}`;
  }
  return text;
}

/** "Sep. 2024" + "Mar. 2026" -> "Sep 2024 – Mar 2026". Also accepts a whole range in `start`. */
export function formatDateRange(start: string, end = ""): string {
  if (!end) {
    const range = matchDateRange(start);
    if (range && range.length >= stripMarkers(start).length - 1) return formatDateRange(range.start, range.end);
  }
  const from = start ? formatDate(start) : "";
  const to = end ? formatDate(end) : "";
  if (from && to && from !== to) return `${from} – ${to}`;
  return from || to;
}

function isDateText(text: string): boolean {
  const range = matchDateRange(text);
  return isSingleDate(text) || (range !== null && range.length >= text.trim().length - 1);
}

/* --------------------------------------------------------------- cleanup */

// Icon fonts whose glyphs extract as their names: Font Awesome in Awesome-CV.
const ICON_NAME =
  /\b(?:ENVELOPE(?:-OPEN)?|PHONE(?:-ALT)?|MOBILE(?:-ALT|-SCREEN(?:-BUTTON)?)?|HOUSE(?:-CHIMNEY)?|HOME|MAP-MARKER(?:-ALT)?|LOCATION-DOT|GLOBE|LINK|LINKEDIN(?:-IN)?|GITHUB(?:-SQUARE|-ALT)?|GITLAB|TWITTER(?:-SQUARE)?|X-TWITTER|STACK-OVERFLOW|SKYPE)\b(?=\s|$|[|,])/g;

function cleanLine(text: string): string {
  return stripIconGlyphs(text)
    .replace(/^(?:[•·▪●■◦–—-]\s+)+/, "")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanContactItem(text: string): string {
  return cleanLine(stripIconGlyphs(text).replace(ICON_NAME, "")).replace(/^[|,·\s]+|[|,·\s]+$/g, "");
}

function splitContact(line: string): string[] {
  return line.split(/\s+[|·•]\s+|\s{3,}/).map(cleanContactItem).filter(Boolean);
}

/**
 * Normal case, one date format, no icon junk, and per section prose and
 * lists before entries (the order canonical markdown can round-trip).
 * `source` is the original CV, whose spelling of acronyms is kept.
 */
export function normalizeCv(model: CvModel, source = ""): CvModel {
  const vocabulary = casingVocabulary(source);
  const text = (value: string) => recase(cleanLine(value), vocabulary);

  return {
    name: text(stripMarkers(model.name)),
    headline: text(stripMarkers(model.headline)),
    // Recase "ISTANBUL, TURKEY", never an email address or a link.
    contact: [...new Set(model.contact.flatMap(splitContact).map((item) => (/[@\d./]/.test(item) ? item : text(item))))],
    sections: model.sections
      .map((section) => {
        const blocks = section.blocks
          .map((block): CvModelBlock | null => {
            if (block.type !== "entry") {
              const value = text(block.text);
              return value ? { type: block.type, text: value } : null;
            }
            const entry = block.entry;
            const title = text(stripMarkers(entry.title));
            const organization = text(stripMarkers(entry.organization));
            if (!title && !organization) return null;
            return {
              type: "entry",
              entry: {
                title: title || organization,
                organization: title ? organization : "",
                location: text(stripMarkers(entry.location)),
                dates: formatDateRange(entry.dates),
                details: entry.details.map(text).filter(Boolean),
                bullets: entry.bullets.map(text).filter(Boolean),
              },
            };
          })
          .filter((block): block is CvModelBlock => block !== null);
        return {
          heading: text(stripMarkers(section.heading)),
          blocks: [...blocks.filter((block) => block.type !== "entry"), ...blocks.filter((block) => block.type === "entry")],
        };
      })
      .filter((section) => section.heading && section.blocks.length > 0),
  };
}

/* -------------------------------------------------- the rewrite's fields */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** Reads the CV fields REWRITE_SCHEMA asks for; null if there is no CV in them. */
export function cvFromFields(data: unknown): CvModel | null {
  if (!isRecord(data) || !Array.isArray(data.sections)) return null;
  const sections = data.sections.filter(isRecord).map((section): CvModelSection => ({
    heading: str(section.heading),
    blocks: [
      ...str(section.paragraph)
        .split(/\n\s*\n/)
        .map((text): CvModelBlock => ({ type: "paragraph", text: text.replace(/\s*\n\s*/g, " ") })),
      ...strings(section.items).map((text): CvModelBlock => ({ type: "item", text })),
      ...(Array.isArray(section.entries) ? section.entries : []).filter(isRecord).map(
        (entry): CvModelBlock => ({
          type: "entry",
          entry: {
            title: str(entry.title),
            organization: str(entry.organization),
            location: str(entry.location),
            dates: formatDateRange(str(entry.startDate), str(entry.endDate)),
            details: [],
            bullets: strings(entry.bullets),
          },
        })
      ),
    ],
  }));
  const model: CvModel = { name: str(data.name), headline: str(data.headline), contact: strings(data.contact), sections };
  return model.name || sections.length > 0 ? model : null;
}

/* ------------------------------------------------------------- markdown */

/**
 * The canonical markdown every other part of the app reads:
 *
 *     # Name
 *     Headline
 *     email | phone | link
 *
 *     ## Experience
 *
 *     ### Job Title
 *     Employer | City | Sep 2024 – Present
 *     - Achievement
 */
export function cvToMarkdown(model: CvModel): string {
  const lines: string[] = [];
  if (model.name) lines.push(`# ${model.name}`);
  if (model.headline) lines.push(model.headline);
  if (model.contact.length > 0) lines.push(model.contact.join(" | "));

  for (const section of model.sections) {
    lines.push("", `## ${section.heading}`, "");
    let previous: CvModelBlock["type"] | null = null;
    for (const block of section.blocks) {
      if (block.type === "paragraph") {
        if (previous) lines.push("");
        lines.push(block.text);
      } else if (block.type === "item") {
        if (previous && previous !== "item") lines.push("");
        lines.push(`- ${block.text}`);
      } else {
        const { entry } = block;
        if (previous) lines.push("");
        lines.push(`### ${entry.title}`);
        const meta = [entry.organization, entry.location, entry.dates].filter(Boolean);
        if (meta.length > 0) lines.push(meta.join(" | "));
        lines.push(...entry.details, ...entry.bullets.map((bullet) => `- ${bullet}`));
      }
      previous = block.type;
    }
  }
  return lines.join("\n").trim();
}

/** "Employer | City | Sep 2024 – Present", in any order and with any of the parts. */
function applyMeta(entry: CvEntry, line: string) {
  const parts = line.split(/\s+[|·•]\s+/);
  // "Northwind Logistics, Istanbul": the last comma part is the place.
  if (parts.length === 1 && !entry.organization && !matchDateRange(line)) {
    const place = /^(.+),\s*([^,]{2,30})$/.exec(stripMarkers(line));
    if (place && !COMPANY_SUFFIX.test(place[2])) {
      entry.organization = place[1];
      entry.location = place[2];
      return;
    }
  }
  for (const raw of parts) {
    let part = stripMarkers(raw);
    if (!entry.dates) {
      if (isDateText(part)) {
        entry.dates = formatDateRange(part);
        continue;
      }
      const range = matchDateRange(part);
      if (range) {
        entry.dates = formatDateRange(range.start, range.end);
        part = (part.slice(0, range.index) + part.slice(range.index + range.length)).replace(/^[\s,|–—-]+|[\s,|–—-]+$/g, "");
      }
    }
    if (!part) continue;
    if (!entry.organization) entry.organization = part;
    else entry.location = entry.location ? `${entry.location}, ${part}` : part;
  }
}

function looksLikeMeta(line: string): boolean {
  return /\s[|·•]\s/.test(line) || isDateText(stripMarkers(line)) || (line.length <= 70 && !SENTENCE.test(line));
}

/** "Backend Developer | Northwind | Sep 2024 – Present", "**Developer**, Acme" -> an entry. */
function startEntry(section: CvModelSection, heading: string): CvEntry {
  const entry: CvEntry = { title: "", organization: "", location: "", dates: "", details: [], bullets: [] };
  const bold = /^\*\*(.+?)\*\*\s*[,|–—-]?\s*(.*)$/.exec(heading.trim());
  const [title, rest] = bold
    ? [bold[1], bold[2]]
    : (() => {
        const [first, ...others] = heading.split(/\s+\|\s+/);
        return [first, others.join(" | ")];
      })();
  entry.title = stripMarkers(title);
  if (rest) applyMeta(entry, rest);
  // A range left in the title itself: "Backend Developer Sep 2024 – Present".
  const range = !entry.dates ? matchDateRange(entry.title) : null;
  if (range) {
    entry.dates = formatDateRange(range.start, range.end);
    entry.title = (entry.title.slice(0, range.index) + entry.title.slice(range.index + range.length)).replace(/[\s,|–—-]+$/, "").trim();
  }
  section.blocks.push({ type: "entry", entry });
  return entry;
}

/**
 * Reads canonical markdown back into a model. Also copes with the looser
 * markdown models used to write ("**Developer**, Acme" then "Jan 2021 – Present").
 */
export function parseCv(markdown: string): CvModel {
  const model: CvModel = { name: "", headline: "", contact: [], sections: [] };
  let section: CvModelSection | null = null;
  let entry: CvEntry | null = null;
  let expectMeta = false;

  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || RULE.test(line)) continue;

    const heading = HEADING.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = stripMarkers(heading[2]);
      if (level === 1 && !model.name && !section) {
        model.name = text;
      } else if (level <= 2 || !section) {
        section = { heading: text, blocks: [] };
        model.sections.push(section);
        entry = null;
      } else {
        entry = startEntry(section, heading[2]);
        expectMeta = !entry.organization;
      }
      continue;
    }

    if (!section) {
      if (!model.name) model.name = stripMarkers(line);
      else if (!model.headline && !CONTACT_HINT.test(line)) model.headline = stripMarkers(line);
      else model.contact.push(...splitContact(line));
      continue;
    }

    const bullet = BULLET.exec(line);
    if (bullet) {
      if (entry) entry.bullets.push(bullet[1].trim());
      else section.blocks.push({ type: "item", text: bullet[1].trim() });
      expectMeta = false;
      continue;
    }

    if (entry && expectMeta && looksLikeMeta(line)) {
      applyMeta(entry, line);
      expectMeta = false;
      continue;
    }
    expectMeta = false;

    const range = matchDateRange(line);
    if (range) {
      const rest = (line.slice(0, range.index) + line.slice(range.index + range.length)).replace(/^[\s,|–—-]+|[\s,|–—-]+$/g, "");
      const previous = section.blocks[section.blocks.length - 1];
      if (!rest && entry && !entry.dates && entry.bullets.length === 0) {
        entry.dates = formatDateRange(range.start, range.end);
        continue;
      }
      if (!rest && !entry && previous?.type === "paragraph" && previous.text.length <= 120) {
        section.blocks.pop();
        entry = startEntry(section, previous.text);
        entry.dates = formatDateRange(range.start, range.end);
        expectMeta = !entry.organization;
        continue;
      }
      if (rest && rest.length <= 120 && !SENTENCE.test(rest) && rest.split(/\s+/).length <= 12) {
        entry = startEntry(section, line);
        expectMeta = !entry.organization;
        continue;
      }
    }

    if (entry && entry.bullets.length === 0) entry.details.push(line);
    else {
      entry = null;
      section.blocks.push({ type: "paragraph", text: line });
    }
  }
  return model;
}

/** Any improved CV markdown -> the canonical markdown, cleaned up. */
export function canonicalCv(markdown: string, source = ""): string {
  return cvToMarkdown(normalizeCv(parseCv(markdown), source));
}

/* ----------------------------------------------------------- plain text */

/** For pasting into application forms and the .txt download. */
export function cvModelToPlainText(model: CvModel): string {
  const lines: string[] = [];
  if (model.name) lines.push(model.name);
  if (model.headline) lines.push(model.headline);
  if (model.contact.length > 0) lines.push(model.contact.join(" | "));

  for (const section of model.sections) {
    lines.push("", section.heading.toUpperCase());
    for (const block of section.blocks) {
      if (block.type === "paragraph") lines.push(stripMarkers(block.text));
      else if (block.type === "item") lines.push(`• ${stripMarkers(block.text)}`);
      else {
        const { entry } = block;
        lines.push("", entry.title);
        const meta = [[entry.organization, entry.location].filter(Boolean).join(", "), entry.dates].filter(Boolean);
        if (meta.length > 0) lines.push(meta.join(" | "));
        lines.push(...entry.details.map(stripMarkers), ...entry.bullets.map((bullet) => `• ${stripMarkers(bullet)}`));
      }
    }
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** "Languages: Go, Python" -> ["Languages", "Go, Python"]; null for a plain item. */
export function splitLabel(text: string): [string, string] | null {
  const match = /^\*{0,2}([^:*]{2,40}?)\*{0,2}:\*{0,2}\s+(.+)$/.exec(text);
  return match ? [match[1].trim(), match[2].trim()] : null;
}
