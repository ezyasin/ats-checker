import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from "docx";

export async function POST(request: NextRequest) {
  try {
    const { improvedCv, format } = await request.json();

    if (!improvedCv || typeof improvedCv !== "string") {
      return NextResponse.json(
        { error: "Improved CV content is required." },
        { status: 400 }
      );
    }

    if (format !== "docx") {
      return NextResponse.json(
        { error: "Only DOCX format is currently supported." },
        { status: 400 }
      );
    }

    // Parse markdown-like content into docx paragraphs
    const lines = improvedCv.split("\n");
    const paragraphs: Paragraph[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        paragraphs.push(new Paragraph({ text: "" }));
        continue;
      }

      if (trimmed.startsWith("# ")) {
        paragraphs.push(
          new Paragraph({
            text: trimmed.replace(/^# /, ""),
            heading: HeadingLevel.HEADING_1,
          })
        );
      } else if (trimmed.startsWith("## ")) {
        paragraphs.push(
          new Paragraph({
            text: trimmed.replace(/^## /, ""),
            heading: HeadingLevel.HEADING_2,
          })
        );
      } else if (trimmed.startsWith("### ")) {
        paragraphs.push(
          new Paragraph({
            text: trimmed.replace(/^### /, ""),
            heading: HeadingLevel.HEADING_3,
          })
        );
      } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: `• ${trimmed.slice(2)}` }),
            ],
          })
        );
      } else if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmed.replace(/\*\*/g, ""),
                bold: true,
              }),
            ],
          })
        );
      } else {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: trimmed })],
          })
        );
      }
    }

    const doc = new Document({
      sections: [{ children: paragraphs }],
    });

    const buffer = await Packer.toBuffer(doc);
    const uint8 = new Uint8Array(buffer);

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="improved-cv.docx"',
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate document." },
      { status: 500 }
    );
  }
}
