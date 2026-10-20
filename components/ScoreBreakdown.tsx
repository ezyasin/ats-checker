"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScoreComponent, ScoreResult } from "@/lib/scoring/types";

function getBarColor(score: number): string {
  if (score >= 81) return "bg-green-500";
  if (score >= 61) return "bg-blue-500";
  if (score >= 31) return "bg-orange-500";
  return "bg-red-500";
}

function formatPoints(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function ComponentRow({ item }: { item: ScoreComponent }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium">{item.label}</span>
        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
          <span className="font-semibold text-foreground">{formatPoints(item.points)}</span>
          {" / "}
          {item.weight} pts
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-700 ${getBarColor(item.score)}`}
          style={{ width: `${item.score}%` }}
        />
      </div>
      <p className="text-sm text-muted-foreground">{item.summary}</p>

      {item.checks.length > 0 && (
        <ul className="grid gap-2 pt-1 sm:grid-cols-2">
          {item.checks.map((check) => (
            <li key={check.id} className="flex items-start gap-2 text-sm">
              {check.passed ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              )}
              <span>
                <span className="font-medium">{check.label}</span>
                {!check.passed && <span className="block text-muted-foreground">{check.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface ScoreBreakdownProps {
  scoring: ScoreResult;
}

export function ScoreBreakdown({ scoring }: ScoreBreakdownProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">How your score is calculated</CardTitle>
        <p className="text-sm text-muted-foreground">
          The score is computed by fixed rules, not by AI, so the same CV and job post always get the same
          result. Each part below adds up to your total of {scoring.total}.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {scoring.components.map((item) => (
          <ComponentRow key={item.key} item={item} />
        ))}
      </CardContent>
    </Card>
  );
}
