"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAnalysisStore } from "@/store/analysis";
import { ScoreGauge } from "@/components/ScoreGauge";
import { KeywordBreakdown } from "@/components/KeywordBreakdown";
import { SuggestionCard } from "@/components/SuggestionCard";
import { SectionScores } from "@/components/SectionScores";import { CVDiffViewer } from "@/components/CVDiffViewer";import { Button } from "@/components/ui/button";
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

  useEffect(() => {
    if (!result) {
      router.replace("/");
    }
    console.log('Results page - result object:', {
      hasResult: !!result,
      hasOriginalCv: !!result?.originalCv,
      hasImprovedCv: !!result?.improvedCv,
      originalCvLength: result?.originalCv?.length,
      improvedCvLength: result?.improvedCv?.length,
    });
  }, [result, router]);

  if (!result) {
    return (
      <div className="flex flex-1 items-center justify-center">
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

  async function handleExport(format: "docx") {
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          improvedCv: result!.improvedCv,
          format,
        }),
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `improved-cv.${format}`;
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
    router.push("/");
  }

  return (
    <main className="flex flex-1 flex-col">
      {/* Header */}
      <div className="border-b bg-gradient-to-b from-primary/5 to-background px-4 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Analysis Results</h1>
            <p className="text-sm text-muted-foreground">
              Here&apos;s how your CV scores against the job description
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
          <Card className="flex items-center justify-center py-8">
            <ScoreGauge score={result.atsScore} verdict={result.verdict} />
          </Card>

          {/* Section Scores */}
          <div className="md:col-span-2">
            <SectionScores scores={result.sectionScores} />
          </div>
        </div>

        <Separator className="my-8" />

        {/* Keywords */}
        <KeywordBreakdown
          matched={result.matchedKeywords}
          missing={result.missingKeywords}
        />

        <Separator className="my-8" />

        {/* Suggestions & Improved CV */}
        <Tabs defaultValue="suggestions">
          <TabsList>
            <TabsTrigger value="suggestions">
              Suggestions ({result.suggestions.length})
            </TabsTrigger>
            <TabsTrigger value="diff">Changes Made (Diff)</TabsTrigger>
            <TabsTrigger value="improved-cv">Improved CV</TabsTrigger>
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
              {result.suggestions
                .sort((a, b) => {
                  const order = { critical: 0, important: 1, optional: 2 };
                  return order[a.priority] - order[b.priority];
                })
                .map((suggestion, i) => (
                  <SuggestionCard key={i} suggestion={suggestion} />
                ))}
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
                  <CVDiffViewer original={result.originalCv} improved={result.improvedCv} />
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    No changes to display
                  </div>
                )}
              </CardContent>
            </Card>
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
                {result.improvedCv ? (
                  <ScrollArea className="h-[600px]">
                    <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
                      {result.improvedCv}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    No improved CV available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
