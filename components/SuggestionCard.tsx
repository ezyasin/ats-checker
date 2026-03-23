"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
          <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
            <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">
              Original
            </p>
            <p className="text-sm">{suggestion.original}</p>
          </div>

          <div className="rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/30">
            <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">
              Suggested
            </p>
            <p className="text-sm">{suggestion.improved}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
