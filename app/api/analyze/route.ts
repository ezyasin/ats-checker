import { NextRequest, NextResponse } from "next/server";
import { extractTextFromPdf } from "@/lib/parsers/pdf";
import { extractTextFromDocx } from "@/lib/parsers/docx";
import { validateFileBytes, validateJobDescription } from "@/lib/validators";
import { createLLMClient, getAvailableProviders, getDefaultProvider } from "@/lib/llm/factory";
import type { AnalysisResult } from "@/types/analysis";
import type { LLMProvider } from "@/lib/llm/types";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("cv") as File | null;
    const jobDescription = formData.get("jobDescription") as string | null;
    const providerParam = formData.get("provider") as string | null;

    // Determine which LLM provider to use
    let provider: LLMProvider = (providerParam as LLMProvider) || getDefaultProvider();
    const available = getAvailableProviders();

    if (!available.includes(provider)) {
      provider = getDefaultProvider();
    }

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

    // Create LLM client and analyze
    try {
      const llmClient = createLLMClient(provider);
      const result = await llmClient.analyze(cvText, jobDescription);
      return NextResponse.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      if (message.includes("API key")) {
        return NextResponse.json(
          { error: `${provider.toUpperCase()} API key is not configured.` },
          { status: 503 }
        );
      }

      console.error(`${provider} analysis error:`, error);
      return NextResponse.json(
        { error: `Failed to analyze with ${provider}. Please try again.` },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
