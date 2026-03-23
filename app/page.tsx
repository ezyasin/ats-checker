"use client";

import { useRouter } from "next/navigation";
import { useAnalysisStore } from "@/store/analysis";
import { UploadZone } from "@/components/UploadZone";
import { JobInput } from "@/components/JobInput";
import { Button } from "@/components/ui/button";

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
      {/* Hero */}
      <section className="border-b bg-gradient-to-b from-primary/5 to-background px-4 py-16 text-center md:py-24">
        <div className="mx-auto max-w-3xl space-y-4">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Check Your{" "}
            <span className="text-primary">ATS Score</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Upload your CV and paste a job description to get an instant ATS
            compatibility score with AI-powered improvement suggestions.
          </p>
        </div>
      </section>

      {/* Input Section */}
      <section className="mx-auto w-full max-w-4xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-2">
          {/* CV Upload */}
          <div className="space-y-3">
            <h2 className="text-sm font-medium">Upload Your CV</h2>
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
            className="min-w-[200px]"
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

        {/* Info text */}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Your CV is processed in memory and never stored on our servers.
        </p>
      </section>
    </main>
  );
}
