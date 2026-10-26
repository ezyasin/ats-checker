import { NextRequest, NextResponse } from "next/server";
import { generateDocx, generateLetterDocx } from "@/lib/exporters/docx";
import { generateLatex } from "@/lib/exporters/latex";

export async function POST(request: NextRequest) {
  try {
    const { improvedCv, coverLetter, format } = await request.json();

    if (typeof coverLetter === "string" && coverLetter.trim()) {
      const letter = await generateLetterDocx(coverLetter);
      return new NextResponse(letter, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": 'attachment; filename="cover-letter.docx"',
        },
      });
    }

    if (!improvedCv || typeof improvedCv !== "string") {
      return NextResponse.json(
        { error: "Improved CV content is required." },
        { status: 400 }
      );
    }

    if (format !== "docx" && format !== "tex") {
      return NextResponse.json(
        { error: "Only DOCX or TEX format is currently supported." },
        { status: 400 }
      );
    }

    if (format === "tex") {
      const tex = generateLatex(improvedCv);
      return new NextResponse(tex, {
        status: 200,
        headers: {
          "Content-Type": "text/x-tex; charset=utf-8",
          "Content-Disposition": 'attachment; filename="improved-cv.tex"',
        },
      });
    }

    const uint8 = await generateDocx(improvedCv);

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
