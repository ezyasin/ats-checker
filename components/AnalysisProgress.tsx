"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, LoaderCircle } from "lucide-react";
import {
  STAGE_PLAN,
  isStageSlow,
  progressValue,
  type AnalysisProgressState,
  type AnalysisStage,
} from "@/lib/analysisStream";
import { cn } from "@/lib/utils";

const STAGE_COPY: Record<AnalysisStage, { title: string; detail: string }> = {
  parse: {
    title: "Reading your CV",
    detail: "Uploading the file and extracting its text.",
  },
  requirements: {
    title: "Reading the job post",
    detail: "Extracting the required skills, job title, experience and degree.",
  },
  score: {
    title: "Scoring your CV",
    detail: "Matching keywords, structure, experience, title and education.",
  },
  rewrite: {
    title: "Writing improvements",
    detail: "Rewriting weak sections without inventing experience. This is the longest step, usually 15–30 seconds.",
  },
};

function formatElapsed(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatDuration(ms: number) {
  return ms < 1000 ? "<1s" : `${(ms / 1000).toFixed(1)}s`;
}

interface AnalysisProgressProps {
  progress: AnalysisProgressState;
  onCancel: () => void;
}

export function AnalysisProgress({ progress, onCancel }: AnalysisProgressProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (progress.done) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [progress.done]);

  const value = progressValue(progress, now);
  const currentIndex = STAGE_PLAN.findIndex((plan) => plan.stage === progress.stage);
  const current = STAGE_COPY[progress.stage];
  const slow = isStageSlow(progress, now);

  return (
    <section
      aria-labelledby="analysis-progress-title"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="analysis-progress-title" className="text-xl font-semibold text-slate-900">
            {progress.done ? "Analysis complete" : "Analyzing your CV"}
          </h2>
          <p className="mt-1 text-sm text-slate-600" aria-live="polite">
            {progress.done
              ? "Opening your results…"
              : `Step ${currentIndex + 1} of ${STAGE_PLAN.length}: ${current.title}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium tabular-nums text-slate-500" aria-label="Elapsed time">
            {formatElapsed(now - progress.startedAt)}
          </span>
          <button
            type="button"
            onClick={onCancel}
            disabled={progress.done}
            className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>

      <div
        role="progressbar"
        aria-label="Analysis progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={progress.done ? "Complete" : current.title}
        className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100"
      >
        <div
          className="h-full origin-left rounded-full bg-blue-600 transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `scaleX(${value / 100})` }}
        />
      </div>

      <ol className="mt-6 space-y-1">
        {STAGE_PLAN.map((plan, index) => {
          const copy = STAGE_COPY[plan.stage];
          const duration = progress.durations[plan.stage];
          const status =
            duration !== undefined ? "done" : index === currentIndex ? "active" : "pending";

          return (
            <li
              key={plan.stage}
              className={cn(
                "flex gap-3 rounded-xl px-3 py-3",
                status === "active" && "bg-blue-50"
              )}
            >
              <span className="mt-0.5 flex-shrink-0">
                {status === "done" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                ) : status === "active" ? (
                  <LoaderCircle className="h-5 w-5 animate-spin text-blue-600 motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-300" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      status === "pending" ? "text-slate-400" : "text-slate-900"
                    )}
                  >
                    {copy.title}
                    <span className="sr-only">
                      {status === "done" ? " (done)" : status === "active" ? " (in progress)" : " (pending)"}
                    </span>
                  </p>
                  {plan.stage === "score" && progress.score ? (
                    <span className="text-sm text-slate-600">
                      Current score{" "}
                      <span className="font-semibold tabular-nums text-slate-900">
                        {progress.score.total}
                      </span>
                      <span className="text-slate-400"> / 100 · </span>
                      {progress.score.verdict}
                    </span>
                  ) : status === "done" ? (
                    <span className="text-xs tabular-nums text-slate-500">{formatDuration(duration!)}</span>
                  ) : null}
                </div>
                {status === "active" && (
                  <p className="mt-1 text-sm text-slate-600">{copy.detail}</p>
                )}
                {status === "active" && slow && (
                  <p className="mt-2 text-sm text-amber-700">
                    This is taking longer than usual. The AI provider may be busy. You can keep waiting or cancel.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
