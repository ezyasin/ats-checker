"use client";

import { useAnalysisStore } from "@/store/analysis";
import { Textarea } from "@/components/ui/textarea";

const MAX_CHARS = 15000;

export function JobInput() {
  const { jobDescription, setJobDescription } = useAnalysisStore();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor="job-description"
          className="text-sm font-medium"
        >
          Job Description
        </label>
        <span
          className={`text-xs ${
            jobDescription.length > MAX_CHARS
              ? "text-destructive"
              : "text-muted-foreground"
          }`}
        >
          {jobDescription.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
        </span>
      </div>
      <Textarea
        id="job-description"
        placeholder="Paste the job description here..."
        value={jobDescription}
        onChange={(e) => setJobDescription(e.target.value)}
        className="min-h-[200px] resize-y"
      />
    </div>
  );
}
