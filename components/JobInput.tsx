"use client";

import { useAnalysisStore } from "@/store/analysis";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

export const MIN_JOB_CHARS = 50;
export const MAX_JOB_CHARS = 15000;

interface JobInputProps {
  className?: string;
}

export function JobInput({ className }: JobInputProps) {
  const { jobDescription, setJobDescription } = useAnalysisStore();
  const length = jobDescription.trim().length;
  const tooLong = length > MAX_JOB_CHARS;
  const tooShort = length > 0 && length < MIN_JOB_CHARS;

  const hint = tooLong
    ? `Too long by ${(length - MAX_JOB_CHARS).toLocaleString()} characters. Remove company boilerplate and benefits.`
    : tooShort
      ? `Add at least ${MIN_JOB_CHARS - length} more characters.`
      : "Include responsibilities, requirements and tools. Benefits and company boilerplate can be left out.";

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Fixed height with its own scrollbar: a long post must not stretch the page. */}
      <Textarea
        id="job-description"
        placeholder="Paste the full job post here…"
        value={jobDescription}
        onChange={(event) => setJobDescription(event.target.value)}
        aria-describedby="job-description-hint"
        aria-invalid={tooLong || undefined}
        spellCheck={false}
        className="field-sizing-fixed h-72 min-h-0 resize-none overflow-y-auto rounded-xl border-slate-300 bg-white px-4 py-3 text-[15px] leading-6 text-slate-900 placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-500/20 sm:h-[360px] md:text-[15px]"
      />
      <div className="mt-3 flex items-start justify-between gap-4 text-xs">
        <p
          id="job-description-hint"
          className={cn("leading-5", tooLong ? "text-red-700" : tooShort ? "text-amber-700" : "text-slate-500")}
        >
          {hint}
        </p>
        <div className="flex flex-shrink-0 items-center gap-3">
          {length > 0 && (
            <button
              type="button"
              onClick={() => setJobDescription("")}
              className="cursor-pointer font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Clear
            </button>
          )}
          <span
            className={cn(
              "font-medium tabular-nums",
              tooLong ? "text-red-700" : "text-slate-500"
            )}
          >
            {length.toLocaleString()} / {MAX_JOB_CHARS.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
