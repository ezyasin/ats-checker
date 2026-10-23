import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
} from "docx";
import { parseInline } from "@/lib/cvMarkdown";
import { parseCv, splitLabel, type CvEntry } from "@/lib/cvModel";

// A4 with 0.7" margins, in twentieths of a point.
const PAGE = { width: 11906, height: 16838, margin: 1008 };
const RIGHT_EDGE = PAGE.width - 2 * PAGE.margin;
const FONT = "Calibri";
const MUTED = "555555";

function runs(text: string, options: { size?: number; color?: string } = {}) {
  return parseInline(text).map((span) => new TextRun({ text: span.text, bold: span.bold, ...options }));
}

function sectionHeading(text: string) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, allCaps: true, size: 22, characterSpacing: 20 })],
    spacing: { before: 240, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 2 } },
    keepNext: true,
  });
}

function entryParagraphs(entry: CvEntry) {
  const place = [entry.organization, entry.location].filter(Boolean).join(", ");
  const paragraphs = [
    // Title left, dates right on one line: one paragraph, so parsers read them together.
    new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_EDGE }],
      spacing: { before: 140 },
      keepNext: true,
      children: [
        new TextRun({ text: entry.title, bold: true }),
        ...(entry.dates ? [new TextRun({ text: `\t${entry.dates}`, color: MUTED })] : []),
      ],
    }),
  ];
  if (place) {
    paragraphs.push(
      new Paragraph({ keepNext: true, spacing: { after: 40 }, children: [new TextRun({ text: place, italics: true, color: MUTED })] })
    );
  }
  for (const detail of entry.details) paragraphs.push(new Paragraph({ children: runs(detail) }));
  for (const bullet of entry.bullets) {
    // A real Word list, which ATS parsers read more reliably than "•" text.
    paragraphs.push(new Paragraph({ children: runs(bullet), bullet: { level: 0 }, spacing: { after: 20 } }));
  }
  return paragraphs;
}

/** Builds a single-column Word CV from the improved CV's markdown. */
export async function generateDocx(improvedCv: string): Promise<Uint8Array<ArrayBuffer>> {
  const cv = parseCv(improvedCv);
  const paragraphs: Paragraph[] = [];

  if (cv.name) {
    paragraphs.push(
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: cv.name, bold: true, size: 36 })] })
    );
  }
  if (cv.headline) {
    paragraphs.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: cv.headline, size: 24 })] }));
  }
  if (cv.contact.length > 0) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60 },
        children: [new TextRun({ text: cv.contact.join("  |  "), size: 19, color: MUTED })],
      })
    );
  }

  for (const section of cv.sections) {
    paragraphs.push(sectionHeading(section.heading));
    for (const block of section.blocks) {
      if (block.type === "entry") {
        paragraphs.push(...entryParagraphs(block.entry));
      } else if (block.type === "paragraph") {
        paragraphs.push(new Paragraph({ children: runs(block.text), spacing: { after: 60 } }));
      } else {
        const label = splitLabel(block.text);
        paragraphs.push(
          label
            ? new Paragraph({
                spacing: { after: 40 },
                children: [new TextRun({ text: `${label[0]}: `, bold: true }), ...runs(label[1])],
              })
            : new Paragraph({ children: runs(block.text), bullet: { level: 0 } })
        );
      }
    }
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 21 }, paragraph: { spacing: { line: 264 } } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE.width, height: PAGE.height },
            margin: { top: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin, right: PAGE.margin },
          },
        },
        children: paragraphs,
      },
    ],
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}

/** The cover letter as a Word document: one paragraph per paragraph of text. */
export async function generateLetterDocx(letter: string): Promise<Uint8Array<ArrayBuffer>> {
  const paragraphs = letter
    .trim()
    .split(/\n\s*\n/)
    .map(
      (block) =>
        new Paragraph({
          spacing: { after: 200 },
          children: block.split("\n").flatMap((line, index) => [
            ...(index > 0 ? [new TextRun({ text: "", break: 1 })] : []),
            new TextRun({ text: line.trim() }),
          ]),
        })
    );
  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 22 }, paragraph: { spacing: { line: 288 } } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE.width, height: PAGE.height },
            margin: { top: 1440, bottom: 1440, left: 1260, right: 1260 },
          },
        },
        children: paragraphs,
      },
    ],
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}
