"use client";

import { useState, type FormEvent } from "react";
import { Plus, RotateCcw, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEGREE_LABEL } from "@/lib/scoring/education";
import type { DegreeLevel, Importance, JobRequirements, RequirementKeyword } from "@/lib/scoring/types";
import { cn } from "@/lib/utils";

const DEGREES = Object.keys(DEGREE_LABEL) as DegreeLevel[];
const FIELD =
  "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-500/20";

interface RequirementsEditorProps {
  requirements: JobRequirements;
  edited: boolean;
  onChange: (next: JobRequirements) => void;
  onReset: () => void;
}

function KeywordPill({
  keyword,
  onToggle,
  onRemove,
}: {
  keyword: RequirementKeyword;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const required = keyword.importance === "required";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border text-sm",
        required ? "border-blue-200 bg-blue-50 text-blue-900" : "border-slate-200 bg-white text-slate-700"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        title={required ? "Move to preferred" : "Move to required"}
        className="cursor-pointer rounded-l-full py-1 pl-3 pr-1.5 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        {keyword.term}
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${keyword.term}`}
        className="cursor-pointer rounded-r-full py-1 pl-0.5 pr-2 text-slate-400 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </span>
  );
}

export function RequirementsEditor({ requirements, edited, onChange, onReset }: RequirementsEditorProps) {
  const [newTerm, setNewTerm] = useState("");
  const [newImportance, setNewImportance] = useState<Importance>("required");
  const [addError, setAddError] = useState<string | null>(null);

  const update = (patch: Partial<JobRequirements>) => onChange({ ...requirements, ...patch });
  const setKeywords = (keywords: RequirementKeyword[]) => update({ keywords });

  function toggle(term: string) {
    setKeywords(
      requirements.keywords.map((keyword) =>
        keyword.term === term
          ? { ...keyword, importance: keyword.importance === "required" ? "preferred" : "required" }
          : keyword
      )
    );
  }

  function remove(term: string) {
    setKeywords(requirements.keywords.filter((keyword) => keyword.term !== term));
  }

  function add(event: FormEvent) {
    event.preventDefault();
    const term = newTerm.trim();
    if (!term) return;
    if (requirements.keywords.some((keyword) => keyword.term.toLowerCase() === term.toLowerCase())) {
      setAddError(`"${term}" is already in the list.`);
      return;
    }
    setKeywords([...requirements.keywords, { term, synonyms: [], category: "hard_skill", importance: newImportance }]);
    setNewTerm("");
    setAddError(null);
  }

  const groups: Array<[Importance, string]> = [
    ["required", "Required"],
    ["preferred", "Preferred"],
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base font-semibold">What this job asks for</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            The AI read these from the job post. If it got something wrong, fix it here. Your score updates instantly,
            calculated in your browser with no new AI call.
          </p>
        </div>
        {edited && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-9 flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reset
          </button>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-slate-700">Job title</span>
            <input
              className={FIELD}
              value={requirements.jobTitle}
              onChange={(event) => update({ jobTitle: event.target.value })}
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-slate-700">Minimum experience (years)</span>
            <input
              type="number"
              min={0}
              max={30}
              className={cn(FIELD, "tabular-nums")}
              value={requirements.minYearsExperience}
              onChange={(event) =>
                update({ minYearsExperience: Math.max(0, Math.min(30, Math.round(Number(event.target.value) || 0))) })
              }
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-slate-700">Minimum degree</span>
            <select
              className={FIELD}
              value={requirements.minDegree}
              onChange={(event) => update({ minDegree: event.target.value as DegreeLevel })}
            >
              {DEGREES.map((degree) => (
                <option key={degree} value={degree}>
                  {degree === "none" ? "None required" : DEGREE_LABEL[degree]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Click a keyword to move it between required and preferred. Required keywords count three times as much.
          </p>
          {groups.map(([importance, label]) => {
            const keywords = requirements.keywords.filter((keyword) => keyword.importance === importance);
            return (
              <div key={importance} className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {label} ({keywords.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {keywords.length === 0 ? (
                    <span className="text-sm text-slate-400">None</span>
                  ) : (
                    keywords.map((keyword) => (
                      <KeywordPill
                        key={keyword.term}
                        keyword={keyword}
                        onToggle={() => toggle(keyword.term)}
                        onRemove={() => remove(keyword.term)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="flex-1">
            <label htmlFor="new-keyword" className="sr-only">
              Keyword to add
            </label>
            <input
              id="new-keyword"
              className={FIELD}
              placeholder="Add a keyword the AI missed, e.g. Terraform"
              value={newTerm}
              onChange={(event) => {
                setNewTerm(event.target.value);
                setAddError(null);
              }}
              aria-invalid={addError ? true : undefined}
              aria-describedby={addError ? "new-keyword-error" : undefined}
            />
            {addError && (
              <p id="new-keyword-error" className="mt-1 text-xs text-red-700">
                {addError}
              </p>
            )}
          </div>
          <label className="sr-only" htmlFor="new-keyword-importance">
            Importance
          </label>
          <select
            id="new-keyword-importance"
            className={cn(FIELD, "sm:w-36")}
            value={newImportance}
            onChange={(event) => setNewImportance(event.target.value as Importance)}
          >
            <option value="required">Required</option>
            <option value="preferred">Preferred</option>
          </select>
          <button
            type="submit"
            disabled={!newTerm.trim()}
            className="inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
