/**
 * Light markdown: `#` headings, `-` bullets and `**bold**`. Whole CVs are
 * laid out by lib/cvModel.ts; the block parser here is for snippets such as
 * suggestions, and `parseInline` handles bold everywhere, so no view or file
 * leaks raw markers.
 */
import { cvModelToPlainText, parseCv } from "./cvModel";

export interface InlineSpan {
  text: string;
  bold: boolean;
}

export type CvBlock =
  | { type: "heading"; level: 1 | 2 | 3; spans: InlineSpan[] }
  | { type: "bullet"; spans: InlineSpan[] }
  | { type: "paragraph"; spans: InlineSpan[] }
  | { type: "blank" };

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^[-*•–]\s+(.*)$/;
const RULE = /^(-{3,}|\*{3,}|_{3,})$/;

export function parseInline(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  const bold = /\*\*(.+?)\*\*|__(.+?)__/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = bold.exec(text))) {
    if (match.index > last) spans.push({ text: text.slice(last, match.index), bold: false });
    spans.push({ text: match[1] ?? match[2], bold: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) spans.push({ text: text.slice(last), bold: false });
  return spans;
}

export function parseCvMarkdown(markdown: string): CvBlock[] {
  return markdown.split("\n").map((line): CvBlock => {
    const trimmed = line.trim();
    if (!trimmed || RULE.test(trimmed)) return { type: "blank" };

    const heading = HEADING.exec(trimmed);
    if (heading) {
      const level = Math.min(heading[1].length, 3) as 1 | 2 | 3;
      return { type: "heading", level, spans: parseInline(heading[2]) };
    }

    const bullet = BULLET.exec(trimmed);
    if (bullet) return { type: "bullet", spans: parseInline(bullet[1]) };

    return { type: "paragraph", spans: parseInline(trimmed) };
  });
}

export function spansToText(spans: InlineSpan[]): string {
  return spans.map((span) => span.text).join("");
}

/** For pasting into application forms and the .txt download. */
export function cvToPlainText(markdown: string): string {
  return cvModelToPlainText(parseCv(markdown));
}
