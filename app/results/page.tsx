"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, FileText, Mail } from "lucide-react";
import { useAnalysisStore } from "@/store/analysis";
import type { AnalysisResult } from "@/types/analysis";
import { scoreCv } from "@/lib/scoring";
import type { JobRequirements } from "@/lib/scoring/types";
import { prioritizeSuggestions } from "@/lib/suggestions";
import { RequirementsEditor } from "@/components/RequirementsEditor";
import { CoverLetter } from "@/components/CoverLetter";
import { ScoreGauge } from "@/components/ScoreGauge";
import { KeywordBreakdown } from "@/components/KeywordBreakdown";
import { SuggestionCard } from "@/components/SuggestionCard";
import { SectionScores } from "@/components/SectionScores";
import { CVDiffViewer } from "@/components/CVDiffViewer";
import { ScoreBreakdown } from "@/components/ScoreBreakdown";
import { AtsView } from "@/components/AtsView";
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
  // The store isn't persisted, so server and first client render agree: no result.
  const result = useAnalysisStore((state) => state.result);

  useEffect(() => {
    if (!result) {
      router.replace("/");
    }
  }, [result, router]);

  if (!result) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return <ResultsContent result={result} />;
}

function ResultsContent({ result }: { result: AnalysisResult }) {
  const router = useRouter();
  const reset = useAnalysisStore((state) => state.reset);
  const [activeTab, setActiveTab] = useState("suggestions");
  // null until the user edits the requirements; then this page re-scores locally.
  const [editedRequirements, setEditedRequirements] = useState<JobRequirements | null>(null);
  const requirements = editedRequirements ?? result.requirements;
  // Kept here so switching tabs doesn't lose the letter or the user's edits to it.
  const [coverLetter, setCoverLetter] = useState<string | null>(null);

  const scoring = useMemo(
    () => (editedRequirements ? scoreCv(result.originalCv, editedRequirements) : result.scoring),
    [editedRequirements, result]
  );
  const improvedScoring = useMemo(
    () =>
      editedRequirements
        ? scoreCv(result.improvedCv, editedRequirements, { unverifiedKeywords: result.unverifiedKeywords })
        : result.improvedScoring,
    [editedRequirements, result]
  );
  const suggestions = useMemo(
    () => (editedRequirements ? prioritizeSuggestions(result.suggestions, editedRequirements, scoring) : result.suggestions),
    [editedRequirements, result, scoring]
  );

  const criticalCount = suggestions.filter((s) => s.priority === "critical").length;
  const importantCount = suggestions.filter((s) => s.priority === "important").length;
  const optionalCount = suggestions.filter((s) => s.priority === "optional").length;
  const improvedCv = result.improvedCv;
  const improvedScore = improvedScoring.total;
  const scoreDelta = improvedScore - scoring.total;

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

  const tabsRef = useRef<HTMLDivElement>(null);
  function openTab(tab: string) {
    setActiveTab(tab);
    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleStartOver}>
              Start Over
            </Button>
            <Button variant="outline" onClick={() => openTab("cover-letter")}>
              <Mail className="h-4 w-4" aria-hidden="true" />
              Cover letter
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
            <ScoreGauge score={scoring.total} verdict={scoring.verdict} />
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
            {editedRequirements && (
              <p className="px-4 text-center text-xs text-blue-700">Re-scored with your edited requirements.</p>
            )}
            {result.unverifiedKeywords.length > 0 && (
              <p className="mx-4 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs leading-5 text-amber-900">
                Not counted: the improved CV mentions {result.unverifiedKeywords.join(", ")} without evidence from your
                CV. Remove {result.unverifiedKeywords.length === 1 ? "it" : "them"} unless you have that experience.
              </p>
            )}
          </Card>

          {/* Section Scores */}
          <div className="md:col-span-2">
            <SectionScores scores={scoring.sectionScores} />
          </div>
        </div>

        {/* Next steps: the two things people come here to take away */}
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => openTab("improved-cv")}
            className="group flex cursor-pointer items-start gap-4 rounded-xl border bg-card p-5 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:hover:bg-blue-950/30"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="flex-1">
              <span className="block font-semibold">Your improved CV is ready</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                Scores {improvedScore} against this job. Preview it, then download it as DOCX, LaTeX or plain text.
              </span>
            </span>
            <ArrowRight className="mt-1 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => openTab("cover-letter")}
            className="group flex cursor-pointer items-start gap-4 rounded-xl border bg-card p-5 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:hover:bg-blue-950/30"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
              <Mail className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="flex-1">
              <span className="block font-semibold">
                {coverLetter ? "Your cover letter" : "Write a cover letter for this job"}
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {coverLetter
                  ? "Open it to edit, copy or download."
                  : "Generated from your CV and this job post in a few seconds, using only facts your CV states."}
              </span>
            </span>
            <ArrowRight className="mt-1 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-8">
          <RequirementsEditor
            requirements={requirements}
            edited={editedRequirements !== null}
            onChange={setEditedRequirements}
            onReset={() => setEditedRequirements(null)}
          />
        </div>

        <div className="mt-8">
          <ScoreBreakdown scoring={scoring} />
        </div>

        <Separator className="my-8" />

        {/* Keywords */}
        <KeywordBreakdown
          matches={scoring.keywordMatches}
          unaddressed={result.unaddressedKeywords}
        />

        <Separator className="my-8" />

        {/* Suggestions & Improved CV */}
        <div ref={tabsRef} className="scroll-mt-6" />
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            <TabsTrigger value="suggestions">
              Suggestions ({suggestions.length})
            </TabsTrigger>
            <TabsTrigger value="improved-cv">Improved CV</TabsTrigger>
            <TabsTrigger value="cover-letter">
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              Cover letter
            </TabsTrigger>
            <TabsTrigger value="diff">Changes</TabsTrigger>
            <TabsTrigger value="ats-view">What the ATS sees</TabsTrigger>
          </TabsList>

          <TabsContent value="suggestions" className="mt-6">
            {/* Priority summary */}
            <p className="mb-2 text-xs text-muted-foreground">
              Ranked by the scoring engine: critical changes add a required keyword, important ones add a preferred
              keyword or fix a structure problem, optional ones improve wording.
            </p>
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
              {suggestions.length === 0 ? (
                <Card>
                  <CardContent className="py-8">
                    <p className="text-center text-muted-foreground">
                      No rewrite suggestions were returned for this run. Try analyzing again with a fuller CV or job post.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                suggestions.map((suggestion, i) => (
                  <SuggestionCard key={i} suggestion={suggestion} evidence={result.keywordEvidence} />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="diff" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Changes made to your CV
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

          <TabsContent value="cover-letter" className="mt-6">
            <CoverLetter
              cvText={result.originalCv}
              requirements={requirements}
              letter={coverLetter}
              onLetterChange={setCoverLetter}
            />
          </TabsContent>

          <TabsContent value="ats-view" className="mt-6">
            <AtsView cvText={result.originalCv} />
          </TabsContent>

          <TabsContent value="improved-cv" className="mt-6">
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-base font-semibold">Improved CV</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Your CV with the suggestions applied, laid out the way the downloads will look.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                {improvedCv.trim().length > 0 ? (
                  <>
                    <ATSOptimizedExport improvedCv={improvedCv} onExport={handleExport} />
                    <div className="rounded-xl bg-slate-100 p-3 sm:p-6 dark:bg-slate-900">
                      <ScrollArea className="h-[720px] rounded-md bg-white shadow-sm ring-1 ring-slate-200">
                        <CvDocument markdown={improvedCv} className="mx-auto max-w-[760px] px-6 py-10 sm:px-12" />
                      </ScrollArea>
                    </div>
                  </>
                ) : (
                  <p className="py-8 text-center text-muted-foreground">No improved CV available</p>
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
            currentScore={scoring.total}
            history={result.improvementHistory}
          />
        </div>
      </div>
    </main>
  );
}
