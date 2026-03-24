"use client";

import { useRouter } from "next/navigation";
import { useAnalysisStore } from "@/store/analysis";
import { UploadZone } from "@/components/UploadZone";
import { JobInput } from "@/components/JobInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const steps = [
  {
    step: "1",
    title: "Upload Your CV",
    description: "Drop your PDF or DOCX resume — we extract the text instantly.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    step: "2",
    title: "Paste Job Description",
    description: "Add the target job posting so we know what to optimize for.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    step: "3",
    title: "Get Your Score",
    description: "AI analyzes your CV and gives a detailed ATS compatibility report.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
];

const features = [
  {
    title: "ATS Score (0–100)",
    description: "See exactly how well your CV matches the job posting with a precise compatibility score.",
  },
  {
    title: "Keyword Analysis",
    description: "Discover which keywords you're missing and which ones you already have covered.",
  },
  {
    title: "Smart Suggestions",
    description: "Get specific, actionable text rewrites prioritized by impact on your score.",
  },
  {
    title: "Section Breakdown",
    description: "See scores for Summary, Skills, Experience, and Education individually.",
  },
  {
    title: "Improved CV Export",
    description: "Download an AI-improved version of your CV as a ready-to-send DOCX file.",
  },
  {
    title: "Privacy First",
    description: "Your CV is processed in memory only — nothing is ever stored on our servers.",
  },
];

export default function HomePage() {
  const router = useRouter();
  const {
    cvFile,
    jobDescription,
    isAnalyzing,
    setAnalyzing,
    setResult,
    setError,
    setCvText,
    error,
  } = useAnalysisStore();

  const canAnalyze =
    cvFile && jobDescription.trim().length >= 50 && !isAnalyzing;

  async function handleAnalyze() {
    if (!cvFile || !canAnalyze) return;

    setAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("cv", cvFile);
      formData.append("jobDescription", jobDescription);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Analysis failed. Please try again.");
        return;
      }

      setResult(data);
      if (data.improvedCv) {
        setCvText(data.improvedCv);
      }
      router.push("/results");
    } catch {
      setError("Network error. Please check your connection and try again.");
    }
  }

  return (
    <main className="flex flex-1 flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b bg-gradient-to-br from-primary/10 via-background to-primary/5 px-4 py-20 md:py-28">
        {/* Background decorative elements */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center rounded-full border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
            AI-Powered Resume Analysis
          </div>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Check Your{" "}
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              ATS Score
            </span>
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Know exactly what ATS systems see in your CV. Get a compatibility
            score, keyword analysis, and AI-powered improvement suggestions.
          </p>

          <a
            href="#analyze"
            className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Start analyzing
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </a>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="border-b bg-muted/30 px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-2 text-center text-sm font-semibold uppercase tracking-wider text-primary">
            How It Works
          </h2>
          <p className="mb-10 text-center text-2xl font-bold">
            Three simple steps to a better CV
          </p>

          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <div
                key={s.step}
                className="relative rounded-xl border bg-background p-6 text-center shadow-sm"
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {s.icon}
                </div>
                <h3 className="mb-1 font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {s.description}
                </p>
                <span className="absolute -top-3 left-4 rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">
                  {s.step}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Analyze Section */}
      <section id="analyze" className="px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-2 text-center text-sm font-semibold uppercase tracking-wider text-primary">
            Analyze
          </h2>
          <p className="mb-10 text-center text-2xl font-bold">
            Upload your CV and paste the job description
          </p>

          <div className="grid gap-8 md:grid-cols-2">
            {/* CV Upload */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Your CV</label>
              <UploadZone />
            </div>

            {/* Job Description */}
            <div>
              <JobInput />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-6 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Analyze Button */}
          <div className="mt-8 flex justify-center">
            <Button
              size="lg"
              onClick={handleAnalyze}
              disabled={!canAnalyze}
              className="min-w-[220px] text-base"
            >
              {isAnalyzing ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Analyzing...
                </span>
              ) : (
                "Analyze ATS Score"
              )}
            </Button>
          </div>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            Your CV is processed in memory and never stored on our servers.
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="border-t bg-muted/30 px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-2 text-center text-sm font-semibold uppercase tracking-wider text-primary">
            Features
          </h2>
          <p className="mb-10 text-center text-2xl font-bold">
            Everything you need to beat the ATS
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title} className="shadow-sm">
                <CardContent className="pt-6">
                  <h3 className="mb-1 font-semibold">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {f.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
