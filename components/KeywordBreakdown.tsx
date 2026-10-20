"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { KeywordMatch, SectionKey } from "@/lib/scoring/types";

const SECTION_LABELS: Record<SectionKey, string> = {
  contact: "header",
  summary: "summary",
  experience: "experience",
  skills: "skills",
  education: "education",
  certifications: "certifications",
  projects: "projects",
  other: "other sections",
};

interface KeywordBreakdownProps {
  matches: KeywordMatch[];
  /** Missing keywords the rewrite couldn't add without inventing experience. */
  unaddressed?: string[];
}

function describeMatch(match: KeywordMatch): string {
  const where = match.sections.map((section) => SECTION_LABELS[section]).join(", ");
  const as = match.matchedAs ? ` as "${match.matchedAs}"` : "";
  return `Found${as} ${match.occurrences}× in ${where}`;
}

function KeywordGroup({
  title,
  items,
  matched,
}: {
  title: string;
  items: KeywordMatch[];
  matched: boolean;
}) {
  if (items.length === 0) return null;
  const className = matched
    ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
    : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400";

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((match) => (
          <Badge
            key={match.term}
            variant="outline"
            className={className}
            title={matched ? describeMatch(match) : `Not found in your CV`}
          >
            {match.term}
            {match.matchedAs && <span className="opacity-70">&nbsp;({match.matchedAs})</span>}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export function KeywordBreakdown({ matches, unaddressed = [] }: KeywordBreakdownProps) {
  const matched = matches.filter((match) => match.matched);
  const missing = matches.filter((match) => !match.matched);
  const byImportance = (items: KeywordMatch[], importance: KeywordMatch["importance"]) =>
    items.filter((match) => match.importance === importance);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            Matched Keywords
            <Badge variant="secondary" className="ml-auto">
              {matched.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {matched.length > 0 ? (
            <>
              <KeywordGroup title="Required" items={byImportance(matched, "required")} matched />
              <KeywordGroup title="Preferred" items={byImportance(matched, "preferred")} matched />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No keywords matched</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
            Missing Keywords
            <Badge variant="secondary" className="ml-auto">
              {missing.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {missing.length > 0 ? (
            <>
              <KeywordGroup title="Required" items={byImportance(missing, "required")} matched={false} />
              <KeywordGroup title="Preferred" items={byImportance(missing, "preferred")} matched={false} />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No keywords missing!</p>
          )}
          {unaddressed.length > 0 && (
            <p className="rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground">
              The improved CV doesn&apos;t add {unaddressed.join(", ")}, because your CV shows no evidence of
              them. If you do have these skills, add them yourself, ideally in a bullet that shows how you used
              them.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
