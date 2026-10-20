import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { parseCvMarkdown, type InlineSpan } from "@/lib/cvMarkdown";

const HEADINGS = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
} as const;

function runs(spans: InlineSpan[]) {
  return spans.map((span) => new TextRun({ text: span.text, bold: span.bold }));
}

/** Builds a single-column Word document from the improved CV's markdown. */
export async function generateDocx(improvedCv: string): Promise<Uint8Array<ArrayBuffer>> {
  const paragraphs = parseCvMarkdown(improvedCv).map((block) => {
    switch (block.type) {
      case "blank":
        return new Paragraph({ text: "" });
      case "heading":
        return new Paragraph({ children: runs(block.spans), heading: HEADINGS[block.level] });
      case "bullet":
        // A real Word list, which ATS parsers read more reliably than "•" text.
        return new Paragraph({ children: runs(block.spans), bullet: { level: 0 } });
      default:
        return new Paragraph({ children: runs(block.spans) });
    }
  });

  const doc = new Document({ sections: [{ children: paragraphs }] });
  return new Uint8Array(await Packer.toBuffer(doc));
}
