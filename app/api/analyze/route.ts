import { NextRequest, NextResponse } from "next/server";
import { extractTextFromPdf } from "@/lib/parsers/pdf";
import { extractTextFromDocx } from "@/lib/parsers/docx";
import { extractTextFromLatex } from "@/lib/parsers/latex";
import { validateFileBytes, validateJobDescription } from "@/lib/validators";
import { createLLMClient, getAvailableProviders, getDefaultProvider } from "@/lib/llm/factory";
import { extractRequirements, rewriteCv } from "@/lib/llm/tasks";
import { LLMError, type LLMProvider } from "@/lib/llm/types";
import { scoreCv } from "@/lib/scoring";
import type { AnalysisResult } from "@/types/analysis";

function llmErrorResponse(error: LLMError) {
  const name = error.provider.toUpperCase();
  switch (error.kind) {
    case "auth":
      return NextResponse.json({ error: `${name} API key is missing or invalid.` }, { status: 503 });
    case "quota":
      return NextResponse.json(
        { error: `${name} quota is exhausted for the configured model. Switch models or try again later.` },
        { status: 503 }
      );
    case "busy":
      return NextResponse.json(
        { error: `${name} is temporarily busy. Please try the analysis again in a minute.` },
        { status: 503 }
      );
    case "refused":
      return NextResponse.json({ error: `${name} declined to process this CV.` }, { status: 422 });
    default:
      return NextResponse.json({ error: `Failed to analyze with ${error.provider}. Please try again.` }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("cv") as File | null;
    const rawJobDescription = formData.get("jobDescription");
    const providerParam = formData.get("provider") as string | null;
    const jobDescription =
      typeof rawJobDescription === "string" ? rawJobDescription.trim() : "";

    let provider: LLMProvider = (providerParam as LLMProvider) || getDefaultProvider();
    const available = getAvailableProviders();

    if (available.length === 0) {
      return NextResponse.json(
        { error: "No AI provider is configured on the server." },
        { status: 503 }
      );
    }

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
        { error: "A reference job post is required for ATS analysis." },
        { status: 400 }
      );
    }

    const jdValidation = validateJobDescription(jobDescription);
    if (!jdValidation.valid) {
      return NextResponse.json(
        { error: jdValidation.error },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const bytesValidation = await validateFileBytes(buffer);
    if (!bytesValidation.valid) {
      return NextResponse.json(
        { error: bytesValidation.error },
        { status: 400 }
      );
    }

    let cvText: string;
    try {
      if (bytesValidation.fileType === "pdf") {
        cvText = await extractTextFromPdf(buffer);
      } else if (bytesValidation.fileType === "latex") {
        cvText = await extractTextFromLatex(buffer);
      } else {
        cvText = await extractTextFromDocx(buffer);
      }
    } catch {
      return NextResponse.json(
        { error: "Failed to parse the uploaded file. Please ensure it is a valid PDF, DOCX, or TEX file." },
        { status: 422 }
      );
    }

    if (!cvText || cvText.trim().length < 50) {
      return NextResponse.json(
        { error: "Could not extract sufficient text from the CV. The file may be image-based or corrupted." },
        { status: 422 }
      );
    }

    try {
      const llmClient = createLLMClient(provider);

      // 1. The LLM turns the job post into structured requirements (cached per post).
      const requirements = await extractRequirements(llmClient, provider, jobDescription);
      // 2. Deterministic scoring: same CV + same requirements = same score.
      const scoring = scoreCv(cvText, requirements);
      // 3. The LLM rewrites the CV, aimed at the gaps the engine found.
      const rewrite = await rewriteCv(llmClient, provider, cvText, jobDescription, scoring);
      // 4. The rewrite is scored by the same engine, never by the LLM.
      const improvedScoring = scoreCv(rewrite.improvedCv, requirements);

      const result: AnalysisResult = {
        atsScore: scoring.total,
        verdict: scoring.verdict,
        matchedKeywords: scoring.keywordMatches.filter((match) => match.matched).map((match) => match.term),
        missingKeywords: scoring.keywordMatches.filter((match) => !match.matched).map((match) => match.term),
        sectionScores: scoring.sectionScores,
        suggestions: rewrite.suggestions,
        originalCv: cvText,
        improvedCv: rewrite.improvedCv,
        requirements,
        scoring,
        improvedScoring,
        unaddressedKeywords: rewrite.unaddressedKeywords,
        improvementHistory: [],
      };

      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof LLMError) {
        return llmErrorResponse(error);
      }
      if (error instanceof Error && error.message.includes("environment variable is not set")) {
        return NextResponse.json(
          { error: `${provider.toUpperCase()} API key is not configured.` },
          { status: 503 }
        );
      }
      throw error;
    }
  } catch {
    return NextResponse.json(
      { error: "An unexpected error occurred during analysis." },
      { status: 500 }
    );
  }
}
