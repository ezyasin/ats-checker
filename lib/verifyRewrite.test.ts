import { describe, expect, it } from "vitest";
import { scoreCv } from "@/lib/scoring";
import type { JobRequirements } from "@/lib/scoring/types";
import { verifyRewrite } from "./verifyRewrite";

const NOW = new Date("2026-10-15T00:00:00Z");

const CV = `Alex Morgan
alex@example.com | +90 555 000 0000
Experience
Backend Developer, Northwind Logistics
Sep 2024 – Mar 2026
- Migrated three Node.js services to Docker and deployed them on AWS
Skills
Go, Python, SQL, Docker, AWS`;

const JOB: JobRequirements = {
  jobTitle: "Backend Engineer",
  titleAliases: [],
  minYearsExperience: 0,
  minDegree: "none",
  keywords: [
    { term: "Go", synonyms: [], category: "hard_skill", importance: "required" },
    { term: "Kafka", synonyms: [], category: "tool", importance: "required" },
    { term: "Kubernetes", synonyms: [], category: "tool", importance: "required" },
    { term: "containerization", synonyms: [], category: "domain", importance: "preferred" },
  ],
};

const scoring = scoreCv(CV, JOB, { now: NOW });

function verify(rewrite: Partial<Parameters<typeof verifyRewrite>[0]>) {
  return verifyRewrite({ suggestions: [], improvedCv: CV, addedKeywords: [], ...rewrite }, CV, JOB, scoring);
}

describe("verifyRewrite", () => {
  it("drops and reverts a suggestion that adds skills without evidence", () => {
    // What a live Gemini rewrite did: append the job's tools to the skills line.
    const original = "Go, Python, SQL, Docker, AWS";
    const improved = "Go, Python, SQL, Docker, AWS, Kafka, Kubernetes";
    const result = verify({
      suggestions: [{ section: "Skills", original, improved, reason: "Adds required tools" }],
      improvedCv: CV.replace(original, improved),
    });
    expect(result.suggestions).toEqual([]);
    expect(result.improvedCv).toBe(CV);
    expect(result.removed.sort()).toEqual(["Kafka", "Kubernetes"]);
  });

  it("removes unproven keywords from skill lists even without a suggestion", () => {
    const result = verify({ improvedCv: CV.replace("Docker, AWS", "Docker, Kafka, AWS") });
    expect(result.improvedCv).toContain("Go, Python, SQL, Docker, AWS");
    expect(result.removed).toEqual(["Kafka"]);
  });

  it("reports unproven keywords left in prose, and the scorer ignores them", () => {
    const result = verify({ improvedCv: `${CV}\n- Built event pipelines with Kafka` });
    expect(result.unverified).toEqual(["Kafka"]);

    const improved = scoreCv(result.improvedCv, JOB, { now: NOW, unverifiedKeywords: result.unverified });
    expect(improved.keywordMatches.find((match) => match.term === "Kafka")).toMatchObject({
      matched: false,
      unverified: true,
    });
    expect(improved.total).toBe(scoreCv(CV, JOB, { now: NOW }).total);
  });

  it("keeps an addition backed by a real quote, and rejects invented or too-short quotes", () => {
    const quote = "Migrated three Node.js services to Docker";
    const result = verify({
      suggestions: [
        { section: "Experience", original: quote, improved: `Containerization: ${quote.toLowerCase()}`, reason: "r" },
      ],
      improvedCv: CV.replace(quote, `Containerization: ${quote.toLowerCase()}`),
      addedKeywords: [
        { keyword: "containerization", evidence: quote },
        { keyword: "Kafka", evidence: "Built event streaming with Kafka" },
        { keyword: "Kubernetes", evidence: "Go" },
      ],
    });
    expect(result.evidence).toEqual({ containerization: quote });
    expect(result.suggestions).toHaveLength(1);
    expect(result.removed).toEqual([]);
  });
});
