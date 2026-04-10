"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAnalysisStore } from "@/store/analysis";
import { UploadZone } from "@/components/UploadZone";
import { JobInput } from "@/components/JobInput";
import { LLMProviderSelector } from "@/components/LLMProviderSelector";

const styles = `
  @keyframes indeterminate-progress {
    0% {
      left: -100%;
    }
    100% {
      left: 100%;
    }
  }
  
  .progress-bar-animate {
    animation: indeterminate-progress 2s infinite ease-in-out;
  }
`;

type AnalysisMode = "job-match" | "cv-only";

export default function AnalyzePage() {
  const router = useRouter();
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("job-match");
  const {
    cvFile,
    jobDescription,
    llmProvider,
    isAnalyzing,
    setAnalyzing,
    setResult,
    setError,
    error,
  } = useAnalysisStore();

  useEffect(() => {
    console.log("isAnalyzing state changed to:", isAnalyzing);
  }, [isAnalyzing]);

  // For job-match mode: need CV and job description (50+ chars)
  // For cv-only mode: only need CV
  const canAnalyze = analysisMode === "job-match"
    ? cvFile && jobDescription.trim().length >= 50 && !isAnalyzing
    : cvFile && !isAnalyzing;

  async function handleAnalyze() {
    if (!cvFile) return;
    if (analysisMode === "job-match" && !jobDescription.trim()) return;

    setError(null);
    setAnalyzing(true);

    // Scroll to top to show loading animation immediately
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const formData = new FormData();
      formData.append("cv", cvFile);
      if (analysisMode === "job-match") {
        formData.append("jobDescription", jobDescription);
      }
      formData.append("provider", llmProvider);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Analysis failed. Please try again.");
        setAnalyzing(false);
        return;
      }

      setResult(data);
      setAnalyzing(false);
      router.push("/results");
    } catch (err) {
      setError("Network error. Please check your connection and try again.");
      setAnalyzing(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <style>{styles}</style>
      {/* Header/Navigation */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => router.push('/')}
              className="font-bold text-xl hover:text-blue-600 transition-colors"
            >
              ATS Checker
            </button>
            <div />
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:border-gray-400 hover:shadow-sm transition-all"
            >
              Back to Home
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold mb-3">
            Analyze Your CV
          </h1>
          <p className="text-lg text-gray-600">
            Choose your analysis mode to get started
          </p>
        </div>

        {/* Mode Selector */}
        <div className="mb-12 grid grid-cols-2 gap-4">
          <button
            onClick={() => setAnalysisMode("job-match")}
            className={`p-6 rounded-lg border-2 transition-all ${
              analysisMode === "job-match"
                ? "border-blue-600 bg-blue-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="text-2xl mb-2">🎯</div>
            <h3 className="font-bold text-lg mb-1">Job Match</h3>
            <p className="text-sm text-gray-600">Compare your CV against a specific job description</p>
          </button>

          <button
            onClick={() => setAnalysisMode("cv-only")}
            className={`p-6 rounded-lg border-2 transition-all ${
              analysisMode === "cv-only"
                ? "border-blue-600 bg-blue-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="text-2xl mb-2">📊</div>
            <h3 className="font-bold text-lg mb-1">CV Score</h3>
            <p className="text-sm text-gray-600">Get your CV's ATS score and improvement areas</p>
          </button>
        </div>

        {/* LLM Provider Selector */}
        <div className="mb-12">
          <LLMProviderSelector />
        </div>

        {/* Main Form */}
        {analysisMode === "job-match" ? (
          // Job Match Mode
          <div className="grid gap-10 lg:grid-cols-2 mb-10">
            {/* CV Upload Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
                  1
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Upload Your CV</h2>
                  <p className="text-sm text-gray-600">PDF or DOCX format</p>
                </div>
              </div>
              <div className="mt-4">
                <UploadZone />
              </div>
            </div>

            {/* Job Description Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
                  2
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Job Description</h2>
                  <p className="text-sm text-gray-600">Paste the target job posting</p>
                </div>
              </div>
              <div className="mt-4">
                <JobInput />
              </div>
            </div>
          </div>
        ) : (
          // CV Only Mode
          <div className="max-w-md mx-auto mb-10">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
                  1
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Upload Your CV</h2>
                  <p className="text-sm text-gray-600">PDF or DOCX format</p>
                </div>
              </div>
              <div className="mt-4">
                <UploadZone />
              </div>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-8 p-4 rounded-lg border border-red-200 bg-red-50">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-semibold text-red-900">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isAnalyzing && (
          <div className="mb-8 p-6 rounded-lg border border-blue-200 bg-blue-50">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-blue-600 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-blue-900">Analyzing your CV...</p>
                <p className="text-sm text-blue-700 mt-1">Our AI is calculating your ATS score</p>
                <div className="mt-3 h-2 bg-blue-100 rounded-full overflow-hidden relative">
                  <div className="absolute h-full bg-gradient-to-r from-transparent via-blue-600 to-transparent w-1/3 progress-bar-animate" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze || isAnalyzing}
            className={`px-8 py-3 rounded-lg font-semibold text-base transition-all duration-300 flex items-center justify-center gap-2 min-w-max ${
              !canAnalyze || isAnalyzing
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm hover:shadow-md"
            }`}
          >
            {isAnalyzing ? (
              <>
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Analyze Now</span>
              </>
            )}
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-8 py-3 rounded-lg font-semibold text-base border-2 border-gray-300 text-gray-700 hover:border-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-all duration-300"
          >
            Back to Home
          </button>
        </div>

        {/* Privacy Notice */}
        <p className="text-center text-sm text-gray-600">
          🔒 Your CV is processed in memory and never stored on our servers.
        </p>
      </div>
    </main>
  );
}
