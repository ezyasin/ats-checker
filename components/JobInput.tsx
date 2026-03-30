"use client";

import { useState } from "react";
import { useAnalysisStore } from "@/store/analysis";
import { Textarea } from "@/components/ui/textarea";

const MAX_CHARS = 15000;

export function JobInput() {
  const { jobDescription, setJobDescription } = useAnalysisStore();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const preview = jobDescription.length > 0 
    ? jobDescription.substring(0, 150) + (jobDescription.length > 150 ? "..." : "")
    : "Paste the job description here...";

  const progress = (jobDescription.length / MAX_CHARS) * 100;
  const progressColor = progress > 100 ? "bg-destructive" : progress > 80 ? "bg-yellow-500" : "bg-green-500";

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
          className={`text-xs font-medium transition-colors ${
            jobDescription.length > MAX_CHARS
              ? "text-destructive"
              : jobDescription.length > 0
              ? "text-green-600"
              : "text-muted-foreground"
          }`}
        >
          {jobDescription.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
        </span>
      </div>

      {/* Collapsible Display */}
      <div className="rounded-lg border border-input bg-background">
        {!isExpanded ? (
          <button
            onClick={() => setIsExpanded(true)}
            className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors text-sm text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="line-clamp-2 text-foreground font-medium">{preview}</div>
              </div>
              <svg className="h-5 w-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </button>
        ) : (
          <div className="space-y-3 p-4">
            <Textarea
              id="job-description"
              placeholder="Paste the job description here..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              className="min-h-[280px] resize-none"
              autoFocus
            />
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full ${progressColor} transition-all duration-300`}
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="px-3 py-1.5 rounded-md bg-muted hover:bg-muted/80 transition-colors text-xs font-medium cursor-pointer"
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
