"use client";

import { useState } from "react";
import { AlertCircle, Check, Copy, Download, FileText, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalysisStore } from "@/store/analysis";
import type { JobRequirements } from "@/lib/scoring/types";

const BUTTON =
  "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50";

interface CoverLetterProps {
  /** The CV as uploaded: the letter may only use facts from it. */
  cvText: string;
  /** The requirements on screen, including the user's edits. */
  requirements: JobRequirements;
  letter: string | null;
  onLetterChange: (letter: string) => void;
}

export function CoverLetter({ cvText, requirements, letter, onLetterChange }: CoverLetterProps) {
  const { jobDescription, llmProvider } = useAnalysisStore();
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const words = letter ? letter.trim().split(/\s+/).filter(Boolean).length : 0;

  async function write() {
    setWriting(true);
    setError(null);
    try {
      const response = await fetch("/api/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cvText, jobDescription, requirements, provider: llmProvider }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || typeof data?.letter !== "string") {
        throw new Error(typeof data?.error === "string" ? data.error : "Couldn't write the letter. Please try again.");
      }
      onLetterChange(data.letter);
    } catch (caught) {
      setError(
        caught instanceof TypeError
          ? "Network error. Check your connection and try again."
          : caught instanceof Error
            ? caught.message
            : "Couldn't write the letter. Please try again."
      );
    } finally {
      setWriting(false);
    }
  }

  async function copy() {
    if (!letter) return;
    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy automatically. Select the text and copy it instead.");
    }
  }

  function save(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadText() {
    if (letter) save(new Blob([letter], { type: "text/plain;charset=utf-8" }), "cover-letter.txt");
  }

  async function downloadDocx() {
    if (!letter) return;
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverLetter: letter }),
      });
      if (!response.ok) throw new Error();
      save(await response.blob(), "cover-letter.docx");
    } catch {
      setError("Couldn't create the Word file. Download the .txt instead, or try again.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Cover letter</CardTitle>
        <p className="text-sm text-muted-foreground">
          Written from your CV and this job post, using only facts your CV states. Read it and make it yours before you
          send it.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" aria-hidden="true" />
            {error}
          </div>
        )}

        {letter === null ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6">
            <p className="text-sm text-slate-600">
              Why you fit the role, backed by achievements from your CV. Skills your CV doesn&apos;t show are left
              out, so a thin CV gives a short letter.
            </p>
            <button
              type="button"
              onClick={write}
              disabled={writing || !jobDescription}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              {writing ? (
                <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              )}
              {writing ? "Writing… usually a few seconds" : "Write cover letter"}
            </button>
            {!jobDescription && (
              <p className="text-xs text-slate-500">The job post is no longer in this session. Run the analysis again to write a letter.</p>
            )}
          </div>
        ) : (
          <>
            <label htmlFor="cover-letter" className="sr-only">
              Cover letter text
            </label>
            <textarea
              id="cover-letter"
              value={letter}
              onChange={(event) => onLetterChange(event.target.value)}
              spellCheck
              className="h-[440px] w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-[15px] leading-7 text-slate-900 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-500/20"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={copy} className={BUTTON}>
                {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button type="button" onClick={downloadDocx} className={BUTTON}>
                <FileText className="h-4 w-4" aria-hidden="true" />
                Download .docx
              </button>
              <button type="button" onClick={downloadText} className={BUTTON}>
                <Download className="h-4 w-4" aria-hidden="true" />
                .txt
              </button>
              <button type="button" onClick={write} disabled={writing} className={BUTTON}>
                {writing ? (
                  <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                )}
                {writing ? "Writing…" : "Write again"}
              </button>
              <span className="ml-auto text-xs tabular-nums text-slate-500">{words} words</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
