/**
 * Keeps the rewritten CV faithful to the original. Models drop what they
 * don't think matters and pad what looks thin: on an Awesome-CV résumé Gemini
 * Flash-Lite left out "Honors & Awards" and "Community" entirely, dropped the
 * location from the contact line, and wrote "Contributed to site reliability
 * engineering efforts" for a role the CV lists without bullets. These checks
 * compare the rewrite with the original and undo that, in code.
 */
import { formatDateRange, type CvModel, type CvModelBlock, type CvModelSection, cleanContactItem } from "./cvModel";
import { matchDateRange } from "./scoring/experience";
import { detectHeading, normalizeText, splitSections } from "./scoring/sections";

const BULLET_GLYPH = /^\s*[•·▪●■◦*–-]\s+/;
const WORD = new RegExp("[\\p{L}\\p{N}]+", "gu");

function words(text: string): string[] {
  return normalizeText(text).match(WORD) ?? [];
}

/** Text as a reader compares it: case, punctuation and spacing don't matter. */
function plain(text: string): string {
  return words(text).join(" ");
}

/** "February 10, 2026 Byungjin Park · Résumé 2", "Page 2 of 3". */
function isPageFurniture(line: string, name: string): boolean {
  if (/^\s*page \d+( of \d+)?\s*$/i.test(line)) return true;
  return name !== "" && plain(line).includes(plain(name)) && /\d\s*$|résumé|resume|curriculum vitae|\bcv\b/i.test(line);
}

/* --------------------------------------------------------------- sections */

/** Lines of an original section as list items, with wrapped lines joined back up. */
function sectionBlocks(text: string, name: string): CvModelBlock[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !isPageFurniture(line, name));
  const bulleted = lines.some((line) => BULLET_GLYPH.test(line));

  const blocks: CvModelBlock[] = [];
  for (const line of lines) {
    const previous = blocks[blocks.length - 1];
    const isBullet = BULLET_GLYPH.test(line);
    const continues =
      previous?.type === "item" &&
      !isBullet &&
      // In a bulleted list every line without a bullet continues the one above;
      // otherwise only a line starting in lowercase does.
      (bulleted || /^\p{Ll}/u.test(line));
    if (continues) {
      previous.text += ` ${line}`;
      continue;
    }
    const text = line.replace(BULLET_GLYPH, "");
    // A short line without a bullet among bullets, or a label line, is a subheading.
    const subheading =
      !isBullet && !/\d/.test(text) && !/[.,;:!?]$/.test(text) && text.split(/\s+/).length <= 4 && lines.length > 1;
    blocks.push(subheading ? { type: "paragraph", text } : { type: "item", text });
  }
  // Only short lines ("English", "Turkish"): a plain list, not subheadings.
  if (!blocks.some((block) => block.type === "item")) {
    return blocks.map((block) => (block.type === "paragraph" ? { type: "item", text: block.text } : block));
  }
  return blocks;
}

function headingWords(heading: string): Set<string> {
  return new Set(words(heading).filter((word) => word.length >= 4));
}

/**
 * Appends original sections the rewrite left out, with their original lines.
 * A section counts as kept when a heading of the same kind or with a word in
 * common is there ("Awards" for "Honors & Awards"), or most of its lines are.
 */
export function restoreSections(model: CvModel, originalCv: string): CvModel {
  const kept = model.sections.map((section) => ({
    key: detectHeading(section.heading)?.key,
    words: headingWords(section.heading),
  }));
  const improvedText = plain(
    model.sections
      .flatMap((section) =>
        section.blocks.map((block) =>
          block.type === "entry"
            ? [block.entry.title, block.entry.organization, ...block.entry.details, ...block.entry.bullets].join(" ")
            : block.text
        )
      )
      .join(" ")
  );

  const restored: CvModelSection[] = [];
  for (const section of splitSections(originalCv)) {
    if (section.key === "contact") continue;
    const own = headingWords(section.heading);
    const present = kept.some(
      (other) =>
        (section.key !== "other" && other.key === section.key) || [...own].some((word) => other.words.has(word))
    );
    if (present) continue;

    const blocks = sectionBlocks(section.text, model.name);
    const items = blocks.filter((block) => block.type === "item");
    if (items.length === 0) continue;
    const carried = items.filter((block) => block.type === "item" && improvedText.includes(plain(block.text)));
    if (carried.length >= items.length / 2) continue;
    restored.push({ heading: section.heading, blocks });
  }
  return restored.length > 0 ? { ...model, sections: [...model.sections, ...restored] } : model;
}

/* ---------------------------------------------------------------- contact */

// "Mapo-gu, Seoul, Republic of Korea", "Istanbul, Turkey": capitalised parts, no digits.
const LOCATION = /^\p{Lu}[\p{L}.'’ -]*(,\s*\p{Lu}[\p{L}.'’ -]*){1,3}$/u;
const CONTACT = /@|\+?\d[\d ()-]{6,}\d|https?:|www\.|\.(?:com|io|dev|me|net|org|co)\b/i;

/** Contact items from the original header (email, phone, link, location) the rewrite dropped. */
export function restoreContact(model: CvModel, originalCv: string): CvModel {
  const header = splitSections(originalCv).find((section) => section.key === "contact");
  if (!header) return model;
  const have = plain([model.name, model.headline, ...model.contact].join(" "));
  const name = plain(model.name);

  const missing: string[] = [];
  for (const line of header.text.split("\n")) {
    // The name line, a motto or a long tagline isn't contact information.
    if ((name && plain(line).includes(name)) || /["“”]/.test(line) || line.trim().length > 160) continue;
    for (const part of line.split(/\s+[|·•]\s+|\s{3,}/)) {
      const item = cleanContactItem(part);
      if (!item || item.length > 60 || have.includes(plain(item))) continue;
      if (CONTACT.test(item) || LOCATION.test(item)) missing.push(item);
    }
  }
  if (missing.length === 0) return model;
  // A location leads the line ("Istanbul, Turkey | email | phone"); the rest follows.
  const locations = missing.filter((item) => !CONTACT.test(item));
  return { ...model, contact: [...locations, ...model.contact, ...missing.filter((item) => CONTACT.test(item))] };
}

/* --------------------------------------------------------------- headline */

/**
 * Drops parts of the headline the original doesn't have. Models add the
 * target job's title: "DevOps Engineer · Software Architect · Backend Engineer"
 * for a CV that says "DevOps Engineer · Software Architect".
 */
export function restoreHeadline(model: CvModel, originalCv: string): CvModel {
  const header = splitSections(originalCv).find((section) => section.key === "contact");
  if (!model.headline || !header) return model;
  // Substrings, not words: PDFs glue the name to the title ("ParkDevOps Engineer").
  const original = words(header.text).join("");
  const parts = model.headline.split(/\s+[·|•/–—-]\s+/);
  const kept = parts.filter((part) => original.includes(words(part).join("")));
  return kept.length === parts.length ? model : { ...model, headline: kept.join(" · ") };
}

/* ---------------------------------------------------------------- bullets */

/**
 * Removes bullets from roles the original lists without any. A role is found
 * in the original by its dates; what lies between those dates and the next
 * role's is its description. Some PDF layouts put every date in a column of
 * its own, so this only runs when most roles in the original do read as
 * dates followed by bullets.
 */
export function dropInventedBullets(model: CvModel, originalCv: string): CvModel {
  const lines = originalCv.split("\n");
  const anchors = lines.flatMap((line, index) => {
    const range = matchDateRange(line);
    return range ? [{ index, dates: formatDateRange(range.start, range.end) }] : [];
  });
  const described = anchors.map((anchor, position) => {
    const end = anchors[position + 1]?.index ?? lines.length;
    return lines
      .slice(anchor.index + 1, end)
      .some((line) => !isPageFurniture(line, model.name) && (BULLET_GLYPH.test(line) || words(line).length >= 12));
  });
  if (anchors.length < 2 || described.filter(Boolean).length < anchors.length / 2) return model;

  const used = new Set<number>();
  const sections = model.sections.map((section) => ({
    ...section,
    blocks: section.blocks.map((block) => {
      if (block.type !== "entry" || !block.entry.dates || block.entry.bullets.length === 0) return block;
      const position = anchors.findIndex((anchor, index) => !used.has(index) && anchor.dates === block.entry.dates);
      if (position === -1) return block;
      used.add(position);
      return described[position] ? block : { ...block, entry: { ...block.entry, bullets: [] } };
    }),
  }));
  return { ...model, sections };
}

/** All of the above, for a rewrite of `originalCv`. */
export function preserveOriginal(model: CvModel, originalCv: string): CvModel {
  if (!originalCv.trim()) return model;
  const steps = [dropInventedBullets, restoreHeadline, restoreContact, restoreSections];
  return steps.reduce((current, step) => step(current, originalCv), model);
}
