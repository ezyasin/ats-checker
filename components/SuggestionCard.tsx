"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CvDocument } from "@/components/CvDocument";
import type { Suggestion } from "@/types/analysis";

const priorityConfig = {
  critical: {
    label: "Critical",
    className: "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400",
  },
  important: {
    label: "Important",
    className:
      "bg-orange-500/10 text-orange-700 border-orange-500/30 dark:text-orange-400",
  },
  optional: {
    label: "Optional",
    className:
      "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400",
  },
};

interface SuggestionCardProps {
  suggestion: Suggestion;
}

export function SuggestionCard({ suggestion }: SuggestionCardProps) {
  const config = priorityConfig[suggestion.priority];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={config.className}>
            {config.label}
          </Badge>
          <Badge variant="secondary">{suggestion.section}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{suggestion.reason}</p>

        <div className="space-y-2">
          {/* Neutral for the original: it's the user's own line, not an error. */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Original
            </p>
            <CvDocument markdown={suggestion.original} compact className="text-slate-600" />
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Suggested
            </p>
            <CvDocument markdown={suggestion.improved} compact className="text-slate-800" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
