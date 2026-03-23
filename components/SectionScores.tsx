"use client";

import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SectionScore } from "@/types/analysis";

interface SectionScoresProps {
  scores: SectionScore;
}

function getBarColor(score: number): string {
  if (score >= 81) return "bg-green-500";
  if (score >= 61) return "bg-blue-500";
  if (score >= 31) return "bg-orange-500";
  return "bg-red-500";
}

const sectionLabels: Record<keyof SectionScore, string> = {
  summary: "Summary",
  skills: "Skills",
  experience: "Experience",
  education: "Education",
};

export function SectionScores({ scores }: SectionScoresProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          Section Scores
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(Object.entries(scores) as [keyof SectionScore, number][]).map(
          ([key, value]) => (
            <div key={key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm">{sectionLabels[key]}</span>
                <span className="text-sm font-medium">{value}%</span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${getBarColor(value)}`}
                  style={{ width: `${value}%` }}
                />
              </div>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
