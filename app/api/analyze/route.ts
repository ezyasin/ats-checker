import { NextRequest, NextResponse } from "next/server";
import { extractTextFromPdf } from "@/lib/parsers/pdf";
import { extractTextFromDocx } from "@/lib/parsers/docx";
import { validateFileBytes, validateJobDescription } from "@/lib/validators";
import { client, getModel } from "@/lib/claude";
import { buildAnalysisPrompt } from "@/lib/promptBuilder";
import type { AnalysisResult } from "@/types/analysis";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("cv") as File | null;
    const jobDescription = formData.get("jobDescription") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "CV file is required." },
        { status: 400 }
      );
    }

    if (!jobDescription) {
      return NextResponse.json(
        { error: "Job description is required." },
        { status: 400 }
      );
    }

    // Validate job description
    const jdValidation = validateJobDescription(jobDescription);
    if (!jdValidation.valid) {
      return NextResponse.json(
        { error: jdValidation.error },
        { status: 400 }
      );
    }

    // Read and validate file bytes
    const buffer = await file.arrayBuffer();
    const bytesValidation = await validateFileBytes(buffer);
    if (!bytesValidation.valid) {
      return NextResponse.json(
        { error: bytesValidation.error },
        { status: 400 }
      );
    }

    // Extract text from file
    let cvText: string;
    try {
      if (bytesValidation.fileType === "pdf") {
        cvText = await extractTextFromPdf(buffer);
      } else {
        cvText = await extractTextFromDocx(buffer);
      }
    } catch {
      return NextResponse.json(
        { error: "Failed to parse the uploaded file. Please ensure it is a valid PDF or DOCX." },
        { status: 422 }
      );
    }

    if (!cvText || cvText.trim().length < 50) {
      return NextResponse.json(
        { error: "Could not extract sufficient text from the CV. The file may be image-based or corrupted." },
        { status: 422 }
      );
    }

    // Build prompt and call Claude
    const prompt = buildAnalysisPrompt(cvText, jobDescription);

    const message = await client.messages.create({
      model: getModel(),
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    });

    // Extract text response
    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "Failed to get analysis from AI. Please try again." },
        { status: 502 }
      );
    }

    // Parse JSON response
    let result: AnalysisResult;
    try {
      const jsonStr = textBlock.text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      result = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI response. Please try again." },
        { status: 502 }
      );
    }

    // Basic validation of result structure
    if (
      typeof result.atsScore !== "number" ||
      result.atsScore < 0 ||
      result.atsScore > 100 ||
      !Array.isArray(result.matchedKeywords) ||
      !Array.isArray(result.missingKeywords) ||
      !Array.isArray(result.suggestions)
    ) {
      return NextResponse.json(
        { error: "AI returned an invalid response structure. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
