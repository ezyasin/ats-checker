import { describe, expect, it } from "vitest";
import { detectDegree } from "./education";
import { findExtractionIssues, isFlaggedWord } from "./extraction";
import { FRONTEND_JOB } from "./fixtures";
import { scoreCv } from "./index";
import { detectHeading } from "./sections";

const NOW = new Date("2026-10-15T00:00:00Z");

function kinds(text: string) {
  return findExtractionIssues(text).map((issue) => issue.kind);
}

describe("findExtractionIssues", () => {
  it("flags lowercase letters stranded in uppercase words, with the Turkish İ hint", () => {
    // As extracted from a real CV typed in uppercase with a Turkish keyboard.
    const [issue] = findExtractionIssues(
      "BACKEND DEVELOPER iNTERN Feb. 2024\nBACHELOR'S DEGREE iN COMPUTER ENGiNEERiNG"
    );
    expect(issue.kind).toBe("mixed_case");
    expect(issue.examples).toEqual(["iNTERN", "ENGiNEERiNG"]);
    expect(issue.onlyLowercaseI).toBe(true);
    expect(findExtractionIssues("PROJECT MANAGEMeNT")[0].onlyLowercaseI).toBe(false);
  });

  it("flags the dotted capital İ and a combining dot", () => {
    expect(kinds("İNTERN at Acme")).toEqual(["dotted_i"]);
    // i + U+0307 is reported once, as mixed case.
    expect(kinds("EXPERi̇ENCE")).toEqual(["mixed_case"]);
  });

  it("leaves real mixed-case terms and plural acronyms alone", () => {
    expect(findExtractionIssues("APIs, LLMs, NoSQL, MySQL, JavaScript, iPhone, macOS, GraphQL, eBPF")).toEqual([]);
    expect(isFlaggedWord("KPIs")).toBe(false);
  });

  it("flags letter-spaced headings and unreadable glyphs", () => {
    expect(kinds("E X P E R I E N C E\nAcme Corp")).toEqual(["spaced_letters"]);
    expect(kinds(" +1 555 0100  jane@example.com")).toEqual(["unreadable"]);
  });
});

describe("Turkish dotted and dotless i", () => {
  it("still detects headings, degrees and keywords", () => {
    expect(detectHeading("EXPERİENCE")?.key).toBe("experience");
    expect(detectHeading("SKİLLS")?.key).toBe("skills");
    expect(detectHeading("EDUCATıON")?.key).toBe("education");
    expect(detectDegree("BS İN Computer Science")).toBe("bachelor");

    const cv = "Jane Doe\nEXPERİENCE\nFrontend Developer, Acme\nJan 2020 – Present\nBuilt apps in React and TypeScrİpt\nSKİLLS\nReact, Next.js";
    const result = scoreCv(cv, FRONTEND_JOB, { now: NOW });
    expect(result.detectedSections).toEqual(expect.arrayContaining(["experience", "skills"]));
    expect(result.keywordMatches.find((match) => match.term === "TypeScript")?.matched).toBe(true);
  });
});
