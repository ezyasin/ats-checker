"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface KeywordBreakdownProps {
  matched: string[];
  missing: string[];
}

export function KeywordBreakdown({ matched, missing }: KeywordBreakdownProps) {
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
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {matched.length > 0 ? (
              matched.map((kw) => (
                <Badge
                  key={kw}
                  variant="outline"
                  className="border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
                >
                  {kw}
                </Badge>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No keywords matched</p>
            )}
          </div>
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
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {missing.length > 0 ? (
              missing.map((kw) => (
                <Badge
                  key={kw}
                  variant="outline"
                  className="border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
                >
                  {kw}
                </Badge>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No keywords missing!</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
