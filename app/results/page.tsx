"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAnalysisStore } from "@/store/analysis";
import { ScoreGauge } from "@/components/ScoreGauge";
import { KeywordBreakdown } from "@/components/KeywordBreakdown";
import { SuggestionCard } from "@/components/SuggestionCard";
import { SectionScores } from "@/components/SectionScores";
import { CVDiffViewer } from "@/components/CVDiffViewer";
import { ScoreBreakdown } from "@/components/ScoreBreakdown";
import { ATSEducationCard, QuickATSTips } from "@/components/ATSEducation";
import { ATSOptimizedExport } from "@/components/ATSOptimizedExport";
import { ImprovementHistory } from "@/components/ImprovementHistory";
import { CvDocument } from "@/components/CvDocument";
import { cvToPlainText } from "@/lib/cvMarkdown";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ResultsPage() {
  const router = useRouter();
  const { result, reset } = useAnalysisStore();
  const [activeTab, setActiveTab] = useState("suggestions");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!result) {
      router.replace("/");
    }
  }, [result, router]);

  if (!result || !mounted) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const criticalCount = result.suggestions.filter(
    (s) => s.priority === "critical"
  ).length;
  const importantCount = result.suggestions.filter(
    (s) => s.priority === "important"
  ).length;
  const optionalCount = result.suggestions.filter(
    (s) => s.priority === "optional"
  ).length;
  const improvedCv = result.improvedCv;
  const improvedScore = result.improvedScoring.total;
  const scoreDelta = improvedScore - result.atsScore;

  async function handleExport(format: "docx" | "txt" | "tex") {
    try {
      if (format === "txt") {
        const blob = new Blob([cvToPlainText(improvedCv)], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "improved-cv.txt";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }

      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          improvedCv,
          format,
        }),
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = format === "tex" ? "improved-cv.tex" : "improved-cv.docx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to export. Please try again.");
    }
  }

  function handleStartOver() {
    reset();
    router.push("/analyze");
  }

  return (
    <main className="flex flex-1 flex-col">
      {/* Header */}
      <div className="border-b bg-gradient-to-b from-primary/5 to-background px-4 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Analysis Results</h1>
            <p className="text-sm text-muted-foreground">
              Here&apos;s how your CV scores against the reference job post
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleStartOver}>
              Start Over
            </Button>
            <Button onClick={() => handleExport("docx")}>
              Download Improved CV
            </Button>
          </div>
        </div>
      </div>

      {/* Results Content */}
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        {/* Top: Score + Section Scores */}
        <div className="grid gap-8 md:grid-cols-3">
          {/* Score Gauge */}
          <Card className="flex flex-col items-center justify-center gap-4 py-8">
            <ScoreGauge score={result.atsScore} verdict={result.verdict} />
            <p className="px-4 text-center text-sm text-muted-foreground">
              Improved CV scores{" "}
              <span className="font-semibold text-foreground">{improvedScore}</span>
              {scoreDelta !== 0 && (
                <span
                  className={
                    scoreDelta > 0
                      ? "ml-1 font-medium text-green-700 dark:text-green-400"
                      : "ml-1 font-medium text-red-700 dark:text-red-400"
                  }
                >
                  ({scoreDelta > 0 ? "+" : ""}
                  {scoreDelta})
                </span>
              )}
            </p>
          </Card>

          {/* Section Scores */}
          <div className="md:col-span-2">
            <SectionScores scores={result.sectionScores} />
          </div>
        </div>

        <div className="mt-8">
          <ScoreBreakdown scoring={result.scoring} />
        </div>

        <Separator className="my-8" />

        {/* Keywords */}
        <KeywordBreakdown
          matches={result.scoring.keywordMatches}
          unaddressed={result.unaddressedKeywords}
        />

        <Separator className="my-8" />

        {/* Suggestions & Improved CV */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
            <TabsTrigger value="suggestions">
              Suggestions ({result.suggestions.length})
            </TabsTrigger>
            <TabsTrigger value="diff">Changes Made (Diff)</TabsTrigger>
            <TabsTrigger value="education">ATS Tips</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
            <TabsTrigger value="improved-cv">CV Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="suggestions" className="mt-6">
            {/* Priority summary */}
            <div className="mb-4 flex gap-4 text-sm">
              {criticalCount > 0 && (
                <span className="text-red-600">
                  {criticalCount} critical
                </span>
              )}
              {importantCount > 0 && (
                <span className="text-orange-600">
                  {importantCount} important
                </span>
              )}
              {optionalCount > 0 && (
                <span className="text-blue-600">
                  {optionalCount} optional
                </span>
              )}
            </div>

            <div className="grid gap-4">
              {result.suggestions.length === 0 ? (
                <Card>
                  <CardContent className="py-8">
                    <p className="text-center text-muted-foreground">
                      No rewrite suggestions were returned for this run. Try analyzing again with a fuller CV or job post.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                [...result.suggestions].sort((a, b) => {
                  const order = { critical: 0, important: 1, optional: 2 };
                  return order[a.priority] - order[b.priority];
                })
                .map((suggestion, i) => (
                  <SuggestionCard key={i} suggestion={suggestion} />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="diff" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Changes Made to Your CV
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.originalCv && result.improvedCv ? (
                  <CVDiffViewer original={result.originalCv} improved={cvToPlainText(result.improvedCv)} />
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    No changes to display
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="education" className="mt-6 space-y-6">
            <QuickATSTips />
            <ATSEducationCard section="howATSWorks" />
            <ATSEducationCard section="commonPitfalls" />
            <ATSEducationCard section="keywordStrategy" />
            <ATSEducationCard section="bestPractices" />
          </TabsContent>

          <TabsContent value="export" className="mt-6">
            <ATSOptimizedExport 
              improvedCv={result.improvedCv}
              onExport={handleExport}
            />
          </TabsContent>

          <TabsContent value="improved-cv" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-sm">
                  <span>Improved CV Preview</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExport("docx")}
                  >
                    Download DOCX
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.improvedCv && typeof result.improvedCv === 'string' && result.improvedCv.trim().length > 0 ? (
                  <ScrollArea className="h-[600px] rounded-lg border bg-white">
                    <CvDocument markdown={result.improvedCv} className="mx-auto max-w-3xl px-6 py-8 sm:px-10" />
                  </ScrollArea>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <p>No improved CV available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Separator className="my-8" />

        {/* Improvement History */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-6">Your Progress</h2>
          <ImprovementHistory 
            currentScore={result.atsScore} 
            history={result.improvementHistory}
          />
        </div>
      </div>
    </main>
  );
}
