"use client";

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { findExtractionIssues, isFlaggedWord, type ExtractionIssue } from "@/lib/scoring/extraction";
import { splitSections } from "@/lib/scoring/sections";
import type { SectionKey } from "@/lib/scoring/types";
import { cn } from "@/lib/utils";

const SECTION_LABEL: Record<SectionKey, string> = {
  contact: "Header",
  summary: "Summary",
  experience: "Experience",
  skills: "Skills",
  education: "Education",
  certifications: "Certifications",
  projects: "Projects",
  other: "Other",
};

/** Sections most ATS profiles expect to fill. */
const EXPECTED: SectionKey[] = ["summary", "experience", "skills", "education"];

// Splitting on a capture group keeps the words at odd indexes.
const WORD_SPLIT = new RegExp("([\\p{L}\\p{M}]+)", "u");

function quote(examples: string[]) {
  return examples.map((example) => `"${example}"`).join(", ");
}

function issueCopy(issue: ExtractionIssue): { title: string; body: string } {
  const plural = issue.count === 1 ? "" : "s";
  switch (issue.kind) {
    case "mixed_case":
      return issue.onlyLowercaseI
        ? {
            title: `${issue.count} word${plural} came out with a lowercase "i" where a capital I belongs`,
            body: `For example ${quote(issue.examples)}. This usually means the text was typed in capitals with a Turkish keyboard or language setting, which uses the dotted İ, and text extraction turned it into "i". Retype those words with a plain capital I, or switch the document language to English before exporting the PDF.`,
          }
        : {
            title: `${issue.count} word${plural} came out with stray lowercase letters`,
            body: `For example ${quote(issue.examples)}. Decorative and small-caps fonts often extract like this. Export your CV with a standard font such as Calibri, Arial or Helvetica.`,
          };
    case "dotted_i":
      return {
        title: `${issue.count} word${plural} use the Turkish dotted capital İ`,
        body: `That's right in Turkish words. In English words such as ${quote(issue.examples)}, an ATS may not match them to searches, because "İ" is not the same letter as "I". Use a plain capital I in English text.`,
      };
    case "spaced_letters":
      return {
        title: "Letter-spaced text was read as separate letters",
        body: `${quote(issue.examples)} reads as single letters, so an ATS can't recognise it as a heading or keyword. Remove the letter spacing from those headings.`,
      };
    case "missing_dash":
      return {
        title: `The dash between your dates was lost`,
        body: `Your dates came out as ${quote(issue.examples)}, with nothing between start and end. The PDF's font doesn't map its dash to text, so the reader drops it, along with hyphens inside words. This checker still reads these as ranges, but a weaker ATS parser may not. Writing "to" between the dates ("Sep 2024 to Mar 2026") always survives.`,
      };
    case "unreadable":
      return {
        title: `${issue.count} icon${plural} or symbol${plural} can't be read as text`,
        body: "Icons such as phone, email, GitHub or LinkedIn turn into junk characters for an ATS, and what they meant is lost: a bare handle like \"ezyasin\" no longer says it's a GitHub profile. Phone numbers and emails are still found by their format. Keep the icons if you like them, but write links in full, e.g. github.com/ezyasin and linkedin.com/in/yourname.",
      };
  }
}

function Highlighted({ text }: { text: string }) {
  return (
    <>
      {text.split(WORD_SPLIT).map((part, index) =>
        index % 2 === 1 && isFlaggedWord(part) ? (
          <mark key={index} className="rounded-sm bg-amber-200/80 px-0.5 text-amber-950">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

interface AtsViewProps {
  /** The text extracted from the uploaded file. */
  cvText: string;
}

export function AtsView({ cvText }: AtsViewProps) {
  const sections = useMemo(() => splitSections(cvText), [cvText]);
  const issues = useMemo(() => findExtractionIssues(cvText), [cvText]);
  const words = cvText.split(/\s+/).filter(Boolean).length;
  const present = new Set(sections.map((section) => section.key));
  const extra = [...present].filter((key) => key !== "contact" && !EXPECTED.includes(key));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">What an ATS reads from your file</CardTitle>
        <p className="text-sm text-muted-foreground">
          This is the raw text we extracted from your CV, the same kind of text an applicant tracking system stores
          and searches. Labels show how each part was recognised.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          {issues.length === 0 ? (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-900">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" aria-hidden="true" />
              No extraction problems found. The text came out clean.
            </div>
          ) : (
            issues.map((issue) => {
              const { title, body } = issueCopy(issue);
              return (
                <div key={issue.kind} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium text-amber-950">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-amber-900">{body}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="mr-1 text-muted-foreground">
            {words.toLocaleString()} words · sections found:
          </span>
          {[...EXPECTED, ...extra].map((key) => {
            const found = present.has(key);
            return (
              <span
                key={key}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  found ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-500"
                )}
              >
                {found ? (
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <Circle className="h-3 w-3" aria-hidden="true" />
                )}
                {SECTION_LABEL[key]}
                {!found && <span className="sr-only">(not found)</span>}
              </span>
            );
          })}
        </div>

        <div className="max-h-[560px] overflow-y-auto rounded-lg border bg-slate-50">
          {sections.map((section, index) => (
            <section key={index} className="border-b border-slate-200 last:border-b-0">
              <div className="sticky top-0 flex items-center gap-2 border-b border-slate-200 bg-white/95 px-4 py-1.5 backdrop-blur">
                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                  {SECTION_LABEL[section.key]}
                </span>
                {section.heading && (
                  <span className="truncate font-mono text-xs text-slate-500">
                    <Highlighted text={section.heading} />
                  </span>
                )}
              </div>
              <pre className="whitespace-pre-wrap break-words px-4 py-3 font-mono text-[13px] leading-6 text-slate-800">
                <Highlighted text={section.text.trim()} />
              </pre>
            </section>
          ))}
        </div>

        <details className="group rounded-lg border bg-white p-4 text-sm">
          <summary className="cursor-pointer font-medium text-slate-900">
            How to make your file easier for an ATS to read
          </summary>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-slate-600">
            <li>Use a single column. Text in tables, text boxes, headers and footers is often skipped or scrambled.</li>
            <li>Use standard headings: Summary, Experience, Skills, Education.</li>
            <li>Write contact details as plain text, not icons.</li>
            <li>Use a standard font and export the PDF or DOCX from a word processor, never a scan or an image.</li>
            <li>Write dates the same way throughout, for example &quot;Jan 2022 – Present&quot;.</li>
          </ul>
        </details>
      </CardContent>
    </Card>
  );
}
