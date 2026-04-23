"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  BriefcaseBusiness,
  CheckCircle2,
  FileText,
  LoaderCircle,
  Sparkles,
  Target,
  UploadCloud,
} from "lucide-react";
import { useAnalysisStore } from "@/store/analysis";
import type { AnalysisResult } from "@/types/analysis";
import { UploadZone } from "@/components/UploadZone";
import { JobInput } from "@/components/JobInput";
import { LLMProviderSelector } from "@/components/LLMProviderSelector";
import { cn } from "@/lib/utils";

type AnalysisStepKey = "upload" | "parse" | "score" | "rewrite" | "finalize";

interface AnalysisStep {
  key: AnalysisStepKey;
  title: string;
  detail: string;
  completeAt: number;
  icon: LucideIcon;
}

interface AnalysisProgress {
  value: number;
  stepKey: AnalysisStepKey;
}

const ANALYSIS_STEPS: AnalysisStep[] = [
  {
    key: "upload",
    title: "Uploading your CV and job post",
    detail: "This part uses real upload progress from your browser so you can see the request leave the page.",
    completeAt: 36,
    icon: UploadCloud,
  },
  {
    key: "parse",
    title: "Extracting and validating text",
    detail: "Reading the CV, normalizing the job post, and checking ATS-friendly structure before scoring.",
    completeAt: 58,
    icon: FileText,
  },
  {
    key: "score",
    title: "Scoring ATS compatibility",
    detail: "Measuring keyword coverage, section structure, and ATS readability against the target role.",
    completeAt: 78,
    icon: Target,
  },
  {
    key: "rewrite",
    title: "Generating targeted suggestions",
    detail: "Drafting role-specific improvements and rewrite suggestions based on the matched and missing signals.",
    completeAt: 92,
    icon: Sparkles,
  },
  {
    key: "finalize",
    title: "Preparing your results",
    detail: "Packaging the score, improved CV, and detailed recommendations for the results screen.",
    completeAt: 100,
    icon: CheckCircle2,
  },
];

const INITIAL_PROGRESS: AnalysisProgress = {
  value: 0,
  stepKey: "upload",
};

function getStepByKey(stepKey: AnalysisStepKey) {
  return ANALYSIS_STEPS.find((step) => step.key === stepKey) ?? ANALYSIS_STEPS[0];
}

function getProcessingStepForValue(value: number): AnalysisStepKey {
  if (value < 58) return "parse";
  if (value < 78) return "score";
  if (value < 92) return "rewrite";
  return "finalize";
}

function getNextProcessingValue(value: number) {
  if (value < 58) return Math.min(58, value + 4);
  if (value < 78) return Math.min(78, value + 3);
  if (value < 92) return Math.min(92, value + 2);
  return Math.min(98, value + 1);
}

function parseAnalysisResponse(xhr: XMLHttpRequest) {
  if (xhr.response && typeof xhr.response === "object") {
    return xhr.response as Record<string, unknown>;
  }

  if (!xhr.responseText) {
    return null;
  }

  try {
    return JSON.parse(xhr.responseText) as Record<string, unknown>;
  } catch {
    return null;
  }
}

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
    typeof candidate.originalCv === "string"
  );
}

export default function AnalyzePage() {
  const router = useRouter();
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const processingTimerRef = useRef<number | null>(null);
  const shouldSuppressAbortErrorRef = useRef(false);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress>(INITIAL_PROGRESS);
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

  const canAnalyze =
    Boolean(cvFile) && jobDescription.trim().length >= 50 && !isAnalyzing;
  const trimmedJobDescription = jobDescription.trim();
  const isCvReady = Boolean(cvFile);
  const isJobPostReady = trimmedJobDescription.length >= 50;
  const remainingJobChars = Math.max(50 - trimmedJobDescription.length, 0);
  const jobCounterTone =
    trimmedJobDescription.length === 0
      ? "border-slate-200 bg-white text-slate-500"
      : isJobPostReady
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-amber-200 bg-amber-50 text-amber-700";
  const selectedProviderLabel =
    llmProvider === "gemini"
      ? "Gemini"
      : llmProvider === "openai"
        ? "OpenAI"
        : "Claude";

  const currentStep = getStepByKey(analysisProgress.stepKey);
  const currentStepIndex = ANALYSIS_STEPS.findIndex(
    (step) => step.key === analysisProgress.stepKey
  );

  function clearProcessingTimer() {
    if (processingTimerRef.current !== null) {
      window.clearInterval(processingTimerRef.current);
      processingTimerRef.current = null;
    }
  }

  function resetProgress() {
    clearProcessingTimer();
    setAnalysisProgress(INITIAL_PROGRESS);
  }

  function startProcessingProgress() {
    clearProcessingTimer();
    setAnalysisProgress((current) => ({
      value: Math.max(current.value, 40),
      stepKey: "parse",
    }));

    processingTimerRef.current = window.setInterval(() => {
      setAnalysisProgress((current) => {
        if (current.value >= 98) {
          clearProcessingTimer();
          return current;
        }

        const nextValue = getNextProcessingValue(current.value);
        return {
          value: nextValue,
          stepKey: getProcessingStepForValue(nextValue),
        };
      });
    }, 450);
  }

  function submitAnalysis(formData: FormData) {
    return new Promise<AnalysisResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open("POST", "/api/analyze");
      xhr.responseType = "json";

      xhr.upload.addEventListener("loadstart", () => {
        setAnalysisProgress({ value: 8, stepKey: "upload" });
      });

      xhr.upload.addEventListener("progress", (event) => {
        if (!event.lengthComputable) return;

        const nextValue = Math.max(
          8,
          Math.round((event.loaded / event.total) * 36)
        );

        setAnalysisProgress({
          value: Math.min(nextValue, 36),
          stepKey: "upload",
        });
      });

      xhr.upload.addEventListener("loadend", () => {
        startProcessingProgress();
      });

      xhr.onload = () => {
        clearProcessingTimer();
        const data = parseAnalysisResponse(xhr);

        if (xhr.status >= 200 && xhr.status < 300 && isAnalysisResult(data)) {
          resolve(data);
          return;
        }

        const message =
          (data && typeof data.error === "string" && data.error) ||
          "Analysis failed. Please try again.";
        reject(new Error(message));
      };

      xhr.onerror = () => {
        clearProcessingTimer();
        reject(new Error("Network error. Please check your connection and try again."));
      };

      xhr.onabort = () => {
        clearProcessingTimer();
        reject(new DOMException("Analysis aborted", "AbortError"));
      };

      xhr.send(formData);
    });
  }

  function handleGoHome() {
    if (isAnalyzing) {
      shouldSuppressAbortErrorRef.current = true;
      xhrRef.current?.abort();
      setAnalyzing(false);
      resetProgress();
    }

    router.push("/");
  }

  useEffect(() => {
    return () => {
      clearProcessingTimer();
      xhrRef.current?.abort();
    };
  }, []);

  async function handleAnalyze() {
    if (!cvFile) {
      setError("Upload your CV to continue.");
      return;
    }

    if (jobDescription.trim().length < 50) {
      setError("Paste a full reference job post so the ATS score has something meaningful to compare against.");
      return;
    }

    setError(null);
    setAnalyzing(true);
    shouldSuppressAbortErrorRef.current = false;
    setAnalysisProgress({
      value: 4,
      stepKey: "upload",
    });

    // Scroll to top to show loading animation immediately
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const formData = new FormData();
      formData.append("cv", cvFile);
      formData.append("jobDescription", jobDescription);
      formData.append("provider", llmProvider);

      const data = await submitAnalysis(formData);
      setAnalysisProgress({
        value: 100,
        stepKey: "finalize",
      });
      await new Promise((resolve) => window.setTimeout(resolve, 220));
      setResult(data);
      xhrRef.current = null;
      router.push("/results");
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError" &&
        shouldSuppressAbortErrorRef.current
      ) {
        shouldSuppressAbortErrorRef.current = false;
        return;
      }

      setError(
        error instanceof Error
          ? error.message
          : "Network error. Please check your connection and try again."
      );
      setAnalyzing(false);
      xhrRef.current = null;
      resetProgress();
    }
  }

  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* Header/Navigation */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => router.push('/')}
              className="font-bold text-xl hover:text-blue-600 transition-colors"
            >
              ATS Checker
            </button>
            <div />
            <button
              onClick={handleGoHome}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:border-gray-400 hover:shadow-sm transition-all"
            >
              {isAnalyzing ? "Cancel and Go Home" : "Back to Home"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        {/* Header */}
        <div className="mb-8 max-w-4xl">
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-[3.75rem]">
            Analyze Your CV Against a Job Post
          </h1>
          <p className="mt-3 max-w-3xl text-lg leading-8 text-gray-600">
            ATS scores only make sense in context. Upload your CV and a reference job post to get a grounded match score, keyword gaps, and rewrite suggestions.
          </p>
        </div>

        <div className="mb-8 rounded-[28px] border border-blue-200 bg-blue-50/80 p-5 sm:p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1 text-sm font-medium text-blue-700">
                <Target className="h-4 w-4" />
                One analysis mode
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                Job-post-based ATS scoring
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-700">
                The score, missing keywords, and rewritten CV are now anchored to one real opening. That prevents misleading upload-only scores that were not tied to any hiring criteria.
              </p>
            </div>

            <div className="rounded-xl border border-white/80 bg-white/80 p-4 text-sm text-gray-700 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 text-blue-600" />
                <p>
                  Use the actual job post you want to apply for. If you switch targets, run a fresh analysis with that new post.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-blue-100 bg-white p-4">
              <FileText className="h-5 w-5 text-blue-700" />
              <p className="mt-3 font-semibold text-gray-900">CV parsing</p>
              <p className="mt-1 text-sm text-gray-600">We extract your actual resume text and check ATS readability.</p>
            </div>
            <div className="rounded-xl border border-blue-100 bg-white p-4">
              <BriefcaseBusiness className="h-5 w-5 text-blue-700" />
              <p className="mt-3 font-semibold text-gray-900">Job alignment</p>
              <p className="mt-1 text-sm text-gray-600">Matched and missing keywords come from the pasted job post.</p>
            </div>
            <div className="rounded-xl border border-blue-100 bg-white p-4">
              <Target className="h-5 w-5 text-blue-700" />
              <p className="mt-3 font-semibold text-gray-900">Targeted rewrite</p>
              <p className="mt-1 text-sm text-gray-600">Suggestions focus on what improves your fit for that specific role.</p>
            </div>
          </div>
        </div>

        {/* LLM Provider Selector */}
        <div className="mb-12">
          <LLMProviderSelector />
        </div>

        <div className="mb-10 grid items-stretch gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <section className="flex h-full flex-col rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_30px_70px_-48px_rgba(15,23,42,0.45)] sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
                1
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Upload your CV
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Add the resume version you actually want to evaluate for this role.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">CV file</p>
                <p className="text-xs text-slate-500">
                  One clean PDF or DOCX file, up to 5MB.
                </p>
              </div>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                PDF or DOCX
              </span>
            </div>

            <div className="mt-4 flex-1">
              <UploadZone className="min-h-[360px]" />
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-500">
              If you want to compare multiple resume versions, replace the file and run a fresh analysis for the same target role.
            </p>
          </section>

          <section className="flex h-full flex-col rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_30px_70px_-48px_rgba(15,23,42,0.45)] sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
                2
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Paste the reference job post
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Include responsibilities, requirements, tools, and any must-have skills.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Reference job post
                </p>
                <p className="text-xs text-slate-500">
                  ATS scoring needs one real role as the comparison target.
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
                  jobCounterTone
                )}
              >
                {trimmedJobDescription.length.toLocaleString()} / 15,000
              </span>
            </div>

            <div className="mt-4 flex-1">
              <JobInput className="h-full" showHeader={false} />
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-500">
              Use the exact posting you plan to apply for. If you switch roles, run the analysis again with that new post.
            </p>
          </section>
        </div>

        <div className="mb-10 grid gap-3 md:grid-cols-3">
          <div
            className={cn(
              "rounded-2xl border p-4",
              isCvReady ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"
            )}
          >
            <div className="flex items-start gap-3">
              {isCvReady ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
              ) : (
                <AlertCircle className="mt-0.5 h-5 w-5 text-slate-500" />
              )}
              <div>
                <p className="text-sm font-semibold text-slate-900">CV ready</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {isCvReady
                    ? cvFile?.name
                    : "Upload one CV file before starting the analysis."}
                </p>
              </div>
            </div>
          </div>

          <div
            className={cn(
              "rounded-2xl border p-4",
              isJobPostReady
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50"
            )}
          >
            <div className="flex items-start gap-3">
              {isJobPostReady ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
              ) : (
                <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />
              )}
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Job post ready
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {isJobPostReady
                    ? "The reference job post is long enough for grounded ATS scoring."
                    : `Add at least ${remainingJobChars} more characters so the score has enough hiring context.`}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Selected model
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {selectedProviderLabel} will handle this run. Keep the provider fixed if you want consistent comparisons between iterations.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-8 p-4 rounded-lg border border-red-200 bg-red-50">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-semibold text-red-900">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isAnalyzing && (
          <div className="mb-8 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-slate-100 p-6 shadow-sm">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-600/10 text-blue-700">
                    <LoaderCircle className="h-6 w-6 animate-spin" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700/80">
                      Live analysis progress
                    </p>
                    <h3 className="mt-1 text-2xl font-bold text-slate-900">
                      {currentStep.title}
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                      {currentStep.detail}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-blue-100 bg-white/90 px-4 py-3 shadow-sm">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Progress
                  </div>
                  <div className="mt-1 text-3xl font-bold text-slate-900">
                    {analysisProgress.value}%
                  </div>
                  <div className="text-xs text-slate-500">
                    Real upload + staged server processing
                  </div>
                </div>
              </div>

              <div
                aria-label="Analysis progress"
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={analysisProgress.value}
                className="rounded-xl border border-blue-100 bg-white/90 p-4 shadow-sm"
                role="progressbar"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-slate-700">
                    {currentStep.title}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {analysisProgress.value < 100 ? "In progress" : "Complete"}
                  </span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 transition-[width] duration-500 ease-out"
                    style={{ width: `${analysisProgress.value}%` }}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {ANALYSIS_STEPS.map((step, index) => {
                  const status =
                    index < currentStepIndex
                      ? "complete"
                      : index === currentStepIndex
                      ? "current"
                      : "upcoming";
                  const StepIcon = step.icon;

                  return (
                    <div
                      key={step.key}
                      className={`rounded-xl border p-4 transition-colors ${
                        status === "complete"
                          ? "border-emerald-200 bg-emerald-50"
                          : status === "current"
                          ? "border-blue-200 bg-blue-50"
                          : "border-slate-200 bg-white/80"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-full ${
                            status === "complete"
                              ? "bg-emerald-100 text-emerald-700"
                              : status === "current"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <StepIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">
                            {step.title}
                          </p>
                          <p className="text-xs text-slate-500">
                            {status === "complete"
                              ? "Done"
                              : status === "current"
                              ? "Working now"
                              : "Up next"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-slate-500">
                Upload progress is measured directly. After the upload finishes, the bar advances through server-side stages and completes the moment your results are ready.
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze || isAnalyzing}
            className={`px-8 py-3 rounded-lg font-semibold text-base transition-all duration-300 flex items-center justify-center gap-2 min-w-max ${
              !canAnalyze || isAnalyzing
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm hover:shadow-md"
            }`}
          >
            {isAnalyzing ? (
              <>
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Analyzing {analysisProgress.value}%</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Analyze Against Job Post</span>
              </>
            )}
          </button>
          <button
            onClick={handleGoHome}
            className="px-8 py-3 rounded-lg font-semibold text-base border-2 border-gray-300 text-gray-700 hover:border-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-all duration-300"
          >
            {isAnalyzing ? "Cancel and Go Home" : "Back to Home"}
          </button>
        </div>

        {/* Privacy Notice */}
        <div className="flex items-center justify-center gap-2 text-center text-sm text-gray-600">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <p>Your CV and job post are processed in memory for analysis and are not stored as saved uploads.</p>
        </div>
      </div>
    </main>
  );
}
