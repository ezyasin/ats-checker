import { NextRequest, NextResponse } from "next/server";
import { createLLMClient, resolveProvider } from "@/lib/llm/factory";
import { llmErrorMessage } from "@/lib/llm/errorMessages";
import { sanitizeRequirements, writeCoverLetter } from "@/lib/llm/tasks";
import { LLMError, describeLLMError, type LLMClient } from "@/lib/llm/types";
import { scoreCv } from "@/lib/scoring";
import type { JobRequirements } from "@/lib/scoring/types";
import { validateJobDescription } from "@/lib/validators";

const MAX_CV_CHARS = 30000;

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const cvText = typeof body.cvText === "string" ? body.cvText.trim() : "";
  const jobDescription = typeof body.jobDescription === "string" ? body.jobDescription.trim() : "";
  if (cvText.length < 50 || cvText.length > MAX_CV_CHARS) {
    return NextResponse.json({ error: "The CV text is missing or too long." }, { status: 400 });
  }
  const jobValidation = validateJobDescription(jobDescription);
  if (!jobValidation.valid) {
    return NextResponse.json({ error: jobValidation.error }, { status: 400 });
  }

  const provider = resolveProvider(body.provider);
  if (!provider) {
    return NextResponse.json({ error: "No AI provider is configured on the server." }, { status: 503 });
  }

  // The client sends the requirements it shows, including the user's edits.
  let requirements: JobRequirements;
  try {
    requirements = sanitizeRequirements(body.requirements, provider);
  } catch {
    return NextResponse.json({ error: "The job requirements are missing." }, { status: 400 });
  }

  let client: LLMClient;
  try {
    client = createLLMClient(provider);
  } catch {
    return NextResponse.json({ error: `${provider.toUpperCase()} API key is not configured.` }, { status: 503 });
  }

  try {
    const letter = await writeCoverLetter(client, provider, cvText, jobDescription, scoreCv(cvText, requirements));
    return NextResponse.json({ letter });
  } catch (error) {
    // Log the cause for the terminal; never the CV or the letter.
    console.error(`[cover-letter] ${provider} failed:`, error instanceof LLMError ? describeLLMError(error) : error);
    if (error instanceof LLMError) {
      const status = error.kind === "invalid_output" || error.kind === "unknown" ? 502 : 503;
      return NextResponse.json({ error: llmErrorMessage(error, "write the cover letter") }, { status });
    }
    return NextResponse.json({ error: "An unexpected error occurred while writing the letter." }, { status: 500 });
  }
}
