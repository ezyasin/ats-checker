import { describe, expect, it } from "vitest";
import { scoreCv } from "@/lib/scoring";
import { FRONTEND_JOB, MID_CV, WEAK_CV } from "@/lib/scoring/fixtures";
import { prioritizeSuggestions } from "./suggestions";

const NOW = new Date("2026-10-15T00:00:00Z");

function rank(cv: string, improved: string, original = "Built dashboards for clients") {
  const scoring = scoreCv(cv, FRONTEND_JOB, { now: NOW });
  return prioritizeSuggestions([{ section: "Experience", original, improved, reason: "r" }], FRONTEND_JOB, scoring)[0];
}

describe("prioritizeSuggestions", () => {
  it("marks a change that adds a missing required keyword as critical", () => {
    // MID_CV lacks TypeScript (required) and AWS (preferred).
    const suggestion = rank(MID_CV, "Built dashboards for clients in React and TypeScript");
    expect(suggestion.priority).toBe("critical");
    expect(suggestion.adds).toEqual(["TypeScript"]);
  });

  it("marks a change that adds only a preferred keyword as important", () => {
    expect(rank(MID_CV, "Built dashboards for clients, deployed on AWS").priority).toBe("important");
  });

  it("marks a change that adds a missing section heading as important", () => {
    // WEAK_CV has no Skills section.
    const suggestion = rank(WEAK_CV, "Skills\nWordPress, PHP, jQuery", "Designed WordPress themes with PHP and jQuery");
    expect(suggestion.priority).toBe("important");
    expect(suggestion.fixes).toEqual(["Skills section"]);
  });

  it("treats date reformatting as optional when dates already parse", () => {
    const suggestion = rank(MID_CV, "Frontend Developer, Acme Corp, January 2021 – Present", "Frontend Developer, Acme Corp, Jan 2021 – Present");
    expect(suggestion).toMatchObject({ priority: "optional", adds: [], fixes: [] });
  });

  it("does not credit keywords the original line already had", () => {
    expect(rank(MID_CV, "Used React daily", "Used React").adds).toEqual([]);
  });

  it("sorts critical first", () => {
    const scoring = scoreCv(MID_CV, FRONTEND_JOB, { now: NOW });
    const ranked = prioritizeSuggestions(
      [
        { section: "Summary", original: "a", improved: "Clearer wording", reason: "r" },
        { section: "Skills", original: "b", improved: "GraphQL", reason: "r" },
      ],
      FRONTEND_JOB,
      scoring
    );
    expect(ranked.map((item) => item.priority)).toEqual(["critical", "optional"]);
  });
});
