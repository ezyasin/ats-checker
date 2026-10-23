"use client";

import { useMemo, useState } from "react";
import { countWords, diffWords } from "@/lib/textDiff";
import { cn } from "@/lib/utils";

interface CVDiffViewerProps {
  original: string;
  /** The improved CV as plain text. */
  improved: string;
}

export function CVDiffViewer({ original, improved }: CVDiffViewerProps) {
  const [showRemoved, setShowRemoved] = useState(true);
  const parts = useMemo(() => diffWords(original, improved), [original, improved]);
  const added = countWords(parts, "added");
  const removed = countWords(parts, "removed");

  if (added === 0 && removed === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">The wording didn&apos;t change, only the layout.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" aria-hidden="true" />
          {added.toLocaleString()} words added
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-400" aria-hidden="true" />
          {removed.toLocaleString()} words removed
        </span>
        <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-muted-foreground">
          <input
            type="checkbox"
            checked={showRemoved}
            onChange={(event) => setShowRemoved(event.target.checked)}
            className="h-4 w-4 accent-blue-600"
          />
          Show removed text
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Capitalisation, punctuation and date styles are ignored, so only real rewording is marked.
      </p>
      <div className="max-h-[600px] overflow-y-auto rounded-lg border bg-white px-5 py-4">
        <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
          {parts.map((part, index) => {
            if (part.type === "removed") {
              if (!showRemoved) return null;
              return (
                <del key={index} className="mx-0.5 rounded-sm bg-red-50 px-0.5 text-red-700 decoration-red-400">
                  {part.text}
                </del>
              );
            }
            return (
              <span
                key={index}
                className={cn(part.type === "added" && "rounded-sm bg-emerald-100 px-0.5 text-emerald-900")}
              >
                {part.text}
              </span>
            );
          })}
        </p>
      </div>
    </div>
  );
}
