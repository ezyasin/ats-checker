"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Circle, ShieldCheck } from "lucide-react";
import { useAnalysisStore } from "@/store/analysis";
import type { AnalysisResult } from "@/types/analysis";
import { UploadZone } from "@/components/UploadZone";
import { JobInput, MAX_JOB_CHARS, MIN_JOB_CHARS } from "@/components/JobInput";
import { LLMProviderSelector } from "@/components/LLMProviderSelector";
import { AnalysisProgress } from "@/components/AnalysisProgress";
import {
  ANALYSIS_STREAM_CONTENT_TYPE,
  advanceProgress,
  completeProgress,
  readEvents,
  startProgress,
  type AnalysisProgressState,
} from "@/lib/analysisStream";
import { cn } from "@/lib/utils";

/** An error whose message is safe to show as is. */
class AnalysisFailure extends Error {}

function isAnalysisResult(data: unknown): data is AnalysisResult {
  if (!data || typeof data !== "object") {
    return false;
  }

  const candidate = data as Record<string, unknown>;

  return (
    typeof candidate.atsScore === "number" &&
    typeof candidate.verdict === "string" &&
    Array.isArray(candidate.matchedKeywords) &&
    Array.isArray(candidate.missingKeywords) &&
    Array.isArray(candidate.suggestions) &&
    typeof candidate.improvedCv === "string" &&
    typeof candidate.originalCv === "string" &&
    typeof candidate.scoring === "object" &&
    candidate.scoring !== null &&
    typeof candidate.improvedScoring === "object" &&
    candidate.improvedScoring !== null
  );
}

async function readErrorMessage(response: Response) {
  try {
    const data = await response.json();
    if (data && typeof data.error === "string") return data.error;
  } catch {
    // Not JSON; fall through to a generic message.
  }
  return "Analysis failed. Please try again.";
}

interface InputCardProps {
  step: number;
  title: string;
  description: string;
  labelFor?: string;
  children: ReactNode;
}

function InputCard({ step, title, description, labelFor, children }: InputCardProps) {
  return (
    <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
          {step}
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {labelFor ? <label htmlFor={labelFor}>{title}</label> : title}
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function ReadyItem({ ready, label }: { ready: boolean; label: string }) {
  return (
    <li className="flex min-w-0 items-center gap-2">
      {ready ? (
        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" aria-hidden="true" />
      ) : (
        <Circle className="h-4 w-4 flex-shrink-0 text-slate-300" aria-hidden="true" />
      )}
      <span className={cn("truncate", ready ? "text-slate-900" : "text-slate-500")} title={label}>
        {label}
      </span>
      <span className="sr-only">{ready ? "(ready)" : "(missing)"}</span>
    </li>
  );
}

export default function AnalyzePage() {
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<AnalysisProgressState | null>(null);
  const {
    cvFile,
    jobDescription,
    llmProvider,
    isAnalyzing,
    setAnalyzing,
    setResult,
    setError,
    error,
  } = useAnalysisStore();

  const trimmedJob = jobDescription.trim();
  const jobWords = trimmedJob ? trimmedJob.split(/\s+/).length : 0;
  const isCvReady = Boolean(cvFile);
  const isJobPostReady = trimmedJob.length >= MIN_JOB_CHARS && trimmedJob.length <= MAX_JOB_CHARS;
  const canAnalyze = isCvReady && isJobPostReady && !isAnalyzing;

  // Leaving the page mid-analysis cancels the request.
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
        setAnalyzing(false);
      }
    };
  }, [setAnalyzing]);

  function handleCancel() {
    abortRef.current?.abort();
    abortRef.current = null;
    setAnalyzing(false);
    setProgress(null);
  }

  async function handleAnalyze() {
    if (!cvFile || !isJobPostReady) return;

    const controller = new AbortController();
    abortRef.current = controller;
    let state = startProgress(Date.now());
    const update = (next: AnalysisProgressState) => {
      state = next;
      setProgress(next);
    };

    setError(null);
    setAnalyzing(true);
    update(state);
    window.scrollTo({ top: 0, behavior: "smooth" });

    try {
      const formData = new FormData();
      formData.append("cv", cvFile);
      formData.append("jobDescription", jobDescription);
      formData.append("provider", llmProvider);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok || !response.body || !contentType.includes(ANALYSIS_STREAM_CONTENT_TYPE)) {
        throw new AnalysisFailure(await readErrorMessage(response));
      }

      // Assigned inside the callback, so keep TypeScript from narrowing them to null.
      let result = null as unknown;
      let streamError = null as string | null;
      await readEvents(response.body, (event) => {
        if (event.type === "stage") {
          update(advanceProgress(state, event.stage, Date.now()));
        } else if (event.type === "score") {
          update({ ...state, score: { total: event.total, verdict: event.verdict } });
        } else if (event.type === "result") {
          result = event.result;
        } else {
          streamError = event.error;
        }
      });

      if (streamError) throw new AnalysisFailure(streamError);
      if (!isAnalysisResult(result)) {
        throw new AnalysisFailure("The analysis was interrupted. Please try again.");
      }

      update(completeProgress(state, Date.now()));
      // A short beat so the finished checklist is visible before navigating.
      await new Promise((resolve) => window.setTimeout(resolve, 400));
      if (controller.signal.aborted) return;

      abortRef.current = null;
      setResult(result);
      router.push("/results");
    } catch (caught) {
      // Cancelled by the user or by leaving the page: nothing to report.
      if (controller.signal.aborted) return;

      abortRef.current = null;
      setProgress(null);
      setError(
        caught instanceof AnalysisFailure
          ? caught.message
          : caught instanceof TypeError
            ? "Network error. Check your connection and try again."
            : "The analysis was interrupted. Please try again."
      );
    }
  }

  return (
    <main className="flex-1 bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-lg font-bold text-slate-900 transition-colors hover:text-blue-700">
            ATS Checker
          </Link>
          {!progress && (
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to home
            </Link>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="mb-8 max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Analyze your CV against a job post
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            Upload your CV and paste the job post you&apos;re applying for. You get a score you can trace back to the
            job&apos;s requirements, the keywords you&apos;re missing, and rewrites that don&apos;t invent experience.
          </p>
        </div>

        {progress ? (
          <AnalysisProgress progress={progress} onCancel={handleCancel} />
        ) : (
          <div className="flex flex-col gap-6">
            <LLMProviderSelector />

            <div className="grid gap-6 lg:grid-cols-2">
              <InputCard step={1} title="Your CV" description="PDF, DOCX or TEX, up to 5 MB.">
                <UploadZone className="h-72 min-h-0 sm:h-[360px]" />
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Text-based files work best. Scanned images can&apos;t be read, by us or by an ATS.
                </p>
              </InputCard>

              <InputCard
                step={2}
                title="Job post"
                description="Paste the full posting for the role you're applying to."
                labelFor="job-description"
              >
                <JobInput />
              </InputCard>
            </div>

            {error && (
              <div role="alert" className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" aria-hidden="true" />
                <p className="text-sm leading-6 text-red-800">{error}</p>
              </div>
            )}

            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <ul className="flex min-w-0 flex-col gap-2 text-sm sm:flex-row sm:gap-6" aria-label="Ready to analyze">
                <ReadyItem ready={isCvReady} label={cvFile ? cvFile.name : "Upload your CV"} />
                <ReadyItem
                  ready={isJobPostReady}
                  label={isJobPostReady ? `Job post, ${jobWords.toLocaleString()} words` : "Paste the job post"}
                />
              </ul>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={!canAnalyze}
                className="inline-flex h-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
              >
                Analyze CV
              </button>
            </div>

            <p className="flex items-center justify-center gap-2 text-center text-sm text-slate-500">
              <ShieldCheck className="h-4 w-4 flex-shrink-0 text-emerald-600" aria-hidden="true" />
              Your CV and job post are processed in memory and never stored.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
