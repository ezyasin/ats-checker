import { describe, expect, it } from "vitest";
import { detectDegree, educationScore } from "./education";
import { findDateRanges, totalYears } from "./experience";
import { BROKEN_PARSE_CV, FRONTEND_JOB, STRONG_CV, WEAK_CV } from "./fixtures";
import { scoreCv } from "./index";
import { matchKeywords, termAliases } from "./keywords";
import { detectHeading, splitSections } from "./sections";
import type { RequirementKeyword } from "./types";

const NOW = new Date("2026-10-15T00:00:00Z");

function keyword(term: string, synonyms: string[] = []): RequirementKeyword {
  return { term, synonyms, category: "hard_skill", importance: "required" };
}

function match(term: string, text: string, synonyms: string[] = []) {
  return matchKeywords([keyword(term, synonyms)], [{ key: "other", heading: "", text }])[0];
}

describe("sections", () => {
  it("detects plain, markdown and decorated headings", () => {
    expect(detectHeading("Experience")?.key).toBe("experience");
    expect(detectHeading("## Work Experience")?.key).toBe("experience");
    expect(detectHeading("**TECHNICAL SKILLS:**")?.key).toBe("skills");
    expect(detectHeading("Skills & Tools")?.key).toBe("skills");
    expect(detectHeading("Licenses & Certifications")?.key).toBe("certifications");
  });

  it("does not treat content lines as headings", () => {
    expect(detectHeading("Experience with React and Redux")).toBeNull();
    expect(detectHeading("Education Consultant, City Council")).toBeNull();
    expect(detectHeading("Python experience")).toBeNull();
  });

  it("supports inline headings without letting sub-labels split a section", () => {
    const sections = splitSections("Skills: React, Go\nLanguages: JavaScript, Python\nEducation\nBSc");
    expect(sections.map((section) => section.key)).toEqual(["skills", "education"]);
    expect(sections[0].text).toContain("React, Go");
    expect(sections[0].text).toContain("Languages: JavaScript");
  });

  it("puts text before the first heading in the contact block", () => {
    const sections = splitSections(STRONG_CV);
    expect(sections[0].key).toBe("contact");
    expect(sections.map((section) => section.key)).toEqual([
      "contact", "summary", "experience", "skills", "education",
    ]);
  });
});

describe("keywords", () => {
  it("matches whole words only", () => {
    expect(match("Java", "Built apps in JavaScript").matched).toBe(false);
    expect(match("SQL", "Tuned PostgreSQL queries").matched).toBe(false);
    expect(match("React", "Built React Native apps").matched).toBe(true);
  });

  it("matches spelling variants and plurals", () => {
    expect(match("Node.js", "Wrote services in nodejs").matched).toBe(true);
    expect(match("Node.js", "Wrote services in Node JS").matched).toBe(true);
    expect(match("Front-end", "Frontend work").matched).toBe(true);
    expect(match("REST API", "Designed REST APIs").matched).toBe(true);
  });

  it("uses built-in and LLM-provided synonyms and reports what matched", () => {
    const k8s = match("Kubernetes", "Ran workloads on k8s");
    expect(k8s.matched).toBe(true);
    expect(k8s.matchedAs).toBe("k8s");
    expect(match("Accessibility", "WCAG 2.1 audits", ["WCAG"]).matched).toBe(true);
    expect(termAliases(keyword("JavaScript"))).toEqual(["JavaScript", "JS", "ECMAScript"]);
  });

  it("ignores generic trailing words but never reduces a term to a generic word", () => {
    expect(match("GraphQL APIs", "Consumed GraphQL from React").matched).toBe(true);
    expect(match("Web Accessibility", "Fixed accessibility issues").matched).toBe(true);
    expect(match("Server-side rendering", "SSR with Next.js").matched).toBe(true);
    expect(match("Web development", "Built web pages").matched).toBe(false);
  });

  it("matches symbols in terms like C++, C# and .NET", () => {
    expect(match("C++", "Embedded C++ firmware").matched).toBe(true);
    expect(match("C++", "Embedded C firmware").matched).toBe(false);
    expect(match("C#", "Unity games in C#").matched).toBe(true);
    expect(match(".NET", "Services on .NET 8").matched).toBe(true);
  });

  it("matches very short terms case-sensitively", () => {
    expect(match("Go", "Microservices in Go and Rust").matched).toBe(true);
    expect(match("Go", "Ready to go the extra mile").matched).toBe(false);
    expect(match("R", "Statistical models in R").matched).toBe(true);
    expect(match("R", "r and d department").matched).toBe(false);
  });

  it("records which sections a keyword appears in", () => {
    const sections = splitSections(STRONG_CV);
    const [graphql] = matchKeywords([keyword("GraphQL")], sections);
    expect(graphql.sections.sort()).toEqual(["experience", "skills"]);
    expect(graphql.occurrences).toBe(2);
  });
});

describe("experience", () => {
  it("parses common date range formats", () => {
    const text = [
      "Jan 2020 – Present",
      "March 2017 - June 2019",
      "03/2015 – 12/2016",
      "2012-05 to 2014-04",
      "2009–2011",
    ].join("\n");
    expect(findDateRanges(text, NOW)).toHaveLength(5);
  });

  it("counts inclusive months and merges overlapping roles", () => {
    expect(totalYears(findDateRanges("Jan 2020 – Dec 2020", NOW))).toBe(1);
    expect(totalYears(findDateRanges("2019 – 2022", NOW))).toBe(3);
    const overlapping = "Jan 2018 – Dec 2020\nJun 2019 – Dec 2021 (part-time)";
    expect(totalYears(findDateRanges(overlapping, NOW))).toBe(4);
  });

  it("ignores phone numbers, implausible and reversed ranges", () => {
    expect(findDateRanges("+1 555-1234 | 1234-5678", NOW)).toHaveLength(0);
    expect(findDateRanges("2022 – 2019", NOW)).toHaveLength(0);
  });

  it("treats Present as the current month", () => {
    expect(totalYears(findDateRanges("Jan 2026 - Present", NOW))).toBe(0.8);
  });
});

describe("education", () => {
  it("detects the highest degree", () => {
    expect(detectDegree("B.Sc. Computer Science")).toBe("bachelor");
    expect(detectDegree("BS in Mathematics; MBA, 2020")).toBe("master");
    expect(detectDegree("PhD in Physics")).toBe("doctorate");
    expect(detectDegree("Certified Scrum Master")).toBe("none");
  });

  it("gives partial credit one level below the requirement", () => {
    expect(educationScore("master", "bachelor")).toBe(100);
    expect(educationScore("associate", "bachelor")).toBe(60);
    expect(educationScore("high_school", "master")).toBe(25);
    expect(educationScore("none", "none")).toBe(100);
  });
});

describe("scoreCv", () => {
  it("is deterministic", () => {
    const first = scoreCv(STRONG_CV, FRONTEND_JOB, { now: NOW });
    const second = scoreCv(STRONG_CV, FRONTEND_JOB, { now: NOW });
    expect(second).toEqual(first);
  });

  it("scores a strong match as Excellent with every keyword found", () => {
    const result = scoreCv(STRONG_CV, FRONTEND_JOB, { now: NOW });
    expect(result.total).toBeGreaterThanOrEqual(90);
    expect(result.verdict).toBe("Excellent");
    expect(result.keywordMatches.every((item) => item.matched)).toBe(true);
    expect(result.yearsOfExperience).toBeGreaterThanOrEqual(8);
    expect(result.detectedDegree).toBe("bachelor");
  });

  it("scores a weak match as Poor and explains why", () => {
    const result = scoreCv(WEAK_CV, FRONTEND_JOB, { now: NOW });
    expect(result.total).toBeLessThanOrEqual(30);
    expect(result.verdict).toBe("Poor");
    const keywords = result.components.find((item) => item.key === "keywords")!;
    expect(keywords.summary).toContain("Missing required: React, TypeScript, Next.js, GraphQL");
    expect(result.yearsOfExperience).toBe(2);
  });

  it("flags a broken parse through structure checks", () => {
    const result = scoreCv(BROKEN_PARSE_CV, FRONTEND_JOB, { now: NOW });
    const structure = result.components.find((item) => item.key === "structure")!;
    const failed = structure.checks.filter((check) => !check.passed).map((check) => check.id);
    expect(failed).toEqual(expect.arrayContaining(["experience", "skills", "dates", "glyphs", "length"]));
    expect(structure.score).toBeLessThanOrEqual(20);
  });

  it("scores job titles without depending on the LLM's alias list", () => {
    const cv = "Experience\nFront-End Developer, Acme Corp\nJan 2021 – Present";
    // Both alias lists were returned by Gemini for the same job post.
    const aliasLists = [
      ["Frontend Developer", "Front-End Engineer", "Web Developer", "Senior UI Engineer"],
      ["Senior Front-End Developer", "Lead Frontend Engineer", "Senior Web Developer", "Frontend Lead"],
      [],
    ];
    const scores = aliasLists.map((titleAliases) => {
      const result = scoreCv(cv, { ...FRONTEND_JOB, titleAliases }, { now: NOW });
      return result.components.find((item) => item.key === "title")!.score;
    });
    expect(scores).toEqual([85, 85, 85]);
  });

  it("gives partial title credit by token, and full credit only for the exact title", () => {
    const title = (cv: string) =>
      scoreCv(cv, { ...FRONTEND_JOB, titleAliases: [] }, { now: NOW }).components.find(
        (item) => item.key === "title"
      )!;
    expect(title("Senior Frontend Engineer at Acme").score).toBe(100);
    expect(title("Backend Engineer at Acme").score).toBe(30);
    expect(title("Barista at Cafe").score).toBe(0);
  });

  it("keeps the weighted points consistent with the total", () => {
    const result = scoreCv(STRONG_CV, FRONTEND_JOB, { now: NOW });
    const sum = result.components.reduce((total, item) => total + item.points, 0);
    expect(Math.abs(sum - result.total)).toBeLessThan(1);
    expect(result.components.reduce((total, item) => total + item.weight, 0)).toBe(100);
  });

  it("scores section headings in a markdown CV the same way", () => {
    const markdown = STRONG_CV
      .replace("Professional Summary", "## Professional Summary")
      .replace("\nExperience\n", "\n## Experience\n")
      .replace("\nSkills\n", "\n## Skills\n")
      .replace("\nEducation\n", "\n## Education\n");
    expect(scoreCv(markdown, FRONTEND_JOB, { now: NOW }).total).toBe(
      scoreCv(STRONG_CV, FRONTEND_JOB, { now: NOW }).total
    );
  });
});
