import { NextRequest, NextResponse } from "next/server";
import { extractTextFromPdf } from "@/lib/parsers/pdf";
import { extractTextFromDocx } from "@/lib/parsers/docx";
import { extractTextFromLatex } from "@/lib/parsers/latex";
import { validateFileBytes, validateJobDescription } from "@/lib/validators";
import { createLLMClient, getAvailableProviders, getDefaultProvider } from "@/lib/llm/factory";
import { extractRequirements, rewriteCv } from "@/lib/llm/tasks";
import { LLMError, describeLLMError, type LLMClient, type LLMProvider } from "@/lib/llm/types";
import { scoreCv } from "@/lib/scoring";
import { ANALYSIS_STREAM_CONTENT_TYPE, encodeEvent, type AnalysisEvent } from "@/lib/analysisStream";
import type { AnalysisResult } from "@/types/analysis";

const MODEL_ENV: Record<LLMProvider, string> = {
  claude: "CLAUDE_MODEL",
  gemini: "GEMINI_MODEL",
  openai: "OPENAI_MODEL",
};

function llmErrorMessage(error: LLMError) {
  const name = error.provider.toUpperCase();
  switch (error.kind) {
    case "model":
      return `The configured ${name} model isn't available. Check ${MODEL_ENV[error.provider]} in .env.local.`;
    case "auth":
      return `${name} API key is missing or invalid.`;
    case "quota":
      return `${name} has used up its daily quota for the configured models. Try again later, or use an API key with billing enabled.`;
    case "busy":
      return `${name} is temporarily busy. Please try the analysis again in a minute.`;
    case "refused":
      return `${name} declined to process this CV.`;
    case "invalid_output":
      return `${name} returned an incomplete response. Please try again.`;
    default:
      return `Failed to analyze with ${error.provider}. Please try again.`;
  }
}

/**
 * Runs the LLM steps after the response has started, reporting each step as
 * it begins. Input errors are caught before this and returned as plain JSON.
 */
function streamAnalysis(
  signal: AbortSignal,
  llmClient: LLMClient,
  provider: LLMProvider,
  cvText: string,
  jobDescription: string
) {
  const encoder = new TextEncoder();
  let cancelled = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const isGone = () => cancelled || signal.aborted;
      const send = (event: AnalysisEvent) => {
        if (isGone()) return;
        try {
          controller.enqueue(encoder.encode(encodeEvent(event)));
        } catch {
          cancelled = true;
        }
      };

      try {
        // 1. The LLM turns the job post into structured requirements (cached per post).
        send({ type: "stage", stage: "requirements" });
        const requirements = await extractRequirements(llmClient, provider, jobDescription);

        // 2. Deterministic scoring: same CV + same requirements = same score.
        send({ type: "stage", stage: "score" });
        const scoring = scoreCv(cvText, requirements);
        send({ type: "score", total: scoring.total, verdict: scoring.verdict });

        // The browser cancelled; skip the most expensive call.
        if (isGone()) return;

        // 3. The LLM rewrites the CV, aimed at the gaps the engine found.
        send({ type: "stage", stage: "rewrite" });
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
        send({ type: "result", result });
      } catch (error) {
        // Log the cause for the terminal; the browser gets a short message.
        console.error(
          `[analyze] ${provider} failed:`,
          error instanceof LLMError ? describeLLMError(error) : error
        );
        send({
          type: "error",
          error:
            error instanceof LLMError
              ? llmErrorMessage(error)
              : "An unexpected error occurred during analysis.",
        });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed by a cancelled reader.
        }
      }
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": `${ANALYSIS_STREAM_CONTENT_TYPE}; charset=utf-8`,
      // no-transform keeps compression from buffering the stream.
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
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

    let llmClient: LLMClient;
    try {
      llmClient = createLLMClient(provider);
    } catch {
      return NextResponse.json(
        { error: `${provider.toUpperCase()} API key is not configured.` },
        { status: 503 }
      );
    }

    return streamAnalysis(request.signal, llmClient, provider, cvText, jobDescription);
  } catch {
    return NextResponse.json(
      { error: "An unexpected error occurred during analysis." },
      { status: 500 }
    );
  }
}
