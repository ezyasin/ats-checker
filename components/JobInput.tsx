"use client";

import { useState } from "react";
import { useAnalysisStore } from "@/store/analysis";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

const MAX_CHARS = 15000;

interface JobInputProps {
  className?: string;
  showHeader?: boolean;
}

export function JobInput({ className, showHeader = true }: JobInputProps) {
  const { jobDescription, setJobDescription } = useAnalysisStore();
  const [isExpanded, setIsExpanded] = useState(jobDescription.length === 0);

  const preview = jobDescription.length > 0
    ? jobDescription.substring(0, 150) + (jobDescription.length > 150 ? "..." : "")
    : "Paste the reference job post here. ATS scoring needs a target role to compare against.";

  const progress = (jobDescription.length / MAX_CHARS) * 100;
  const progressColor =
    progress > 100
      ? "bg-destructive"
      : progress > 80
        ? "bg-amber-500"
        : "bg-blue-600";
  const counterTone =
    jobDescription.length > MAX_CHARS
      ? "border-red-200 bg-red-50 text-red-700"
      : jobDescription.length > 0
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : "border-slate-200 bg-white text-slate-500";
  const helperText =
    jobDescription.length >= 300
      ? "Good detail level. Double-check that required tools, scope, and seniority are all included."
      : "Paste enough of the post to capture responsibilities, tools, and must-have skills.";

  return (
    <div className={cn("flex h-full flex-col gap-3", className)}>
      {showHeader && (
        <>
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="job-description"
              className="text-sm font-semibold text-slate-900"
            >
              Reference Job Post
            </label>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                counterTone
              )}
            >
              {jobDescription.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Required for ATS scoring. Paste the responsibilities, requirements, and skills from the target role.
          </p>
        </>
      )}

      <div className="flex h-full flex-col rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
        {!isExpanded ? (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="flex min-h-[320px] w-full flex-1 flex-col justify-between rounded-[18px] border border-dashed border-slate-200 bg-white p-5 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">
                  Current job post
                </p>
                <div className="line-clamp-5 text-sm leading-6 text-slate-600">
                  {preview}
                </div>
              </div>
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                Expand editor
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-xs text-slate-500">
              <span>
                Review or replace the pasted job post before running a new analysis.
              </span>
              <span className="font-semibold text-slate-700">
                {jobDescription.length.toLocaleString()} characters
              </span>
            </div>
          </button>
        ) : (
          <div className="flex h-full flex-col gap-4">
            <Textarea
              id="job-description"
              placeholder="Paste the full reference job post here..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              className="min-h-[320px] flex-1 resize-none rounded-[20px] border-slate-200 bg-white px-4 py-4 text-[15px] leading-7 shadow-sm"
              aria-label={showHeader ? undefined : "Reference job post"}
              autoFocus
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>{helperText}</span>
                  {!showHeader && (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2.5 py-1 font-semibold transition-colors",
                        counterTone
                      )}
                    >
                      {jobDescription.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full ${progressColor} transition-all duration-300`}
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100"
              >
                Collapse
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
