import { describe, expect, it, vi } from "vitest";
import { buildRewritePrompt } from "../promptBuilder";
import { scoreCv } from "../scoring";
import { FRONTEND_JOB, WEAK_CV } from "../scoring/fixtures";
import { extractRequirements, sanitizeRequirements, sanitizeRewrite } from "./tasks";
import { LLMError, parseJsonObject, type LLMClient } from "./types";

describe("sanitizeRequirements", () => {
  it("dedupes keywords, clamps numbers and defaults unknown enums", () => {
    const result = sanitizeRequirements(
      {
        jobTitle: "  Data Engineer ",
        titleAliases: ["ETL Developer", 42, ""],
        keywords: [
          { term: "Python", synonyms: [], category: "hard_skill", importance: "required" },
          { term: "python", synonyms: [], category: "hard_skill", importance: "preferred" },
          { term: "Airflow", synonyms: ["Apache Airflow"], category: "framework", importance: "nice" },
          { term: "", synonyms: [], category: "tool", importance: "required" },
        ],
        minYearsExperience: 99,
        minDegree: "phd",
      },
      "gemini"
    );

    expect(result.jobTitle).toBe("Data Engineer");
    expect(result.titleAliases).toEqual(["ETL Developer"]);
    expect(result.keywords.map((keyword) => keyword.term)).toEqual(["Python", "Airflow"]);
    expect(result.keywords[1]).toMatchObject({ category: "hard_skill", importance: "required" });
    expect(result.minYearsExperience).toBe(30);
    expect(result.minDegree).toBe("none");
  });

  it("rejects payloads without a keyword list", () => {
    expect(() => sanitizeRequirements({ jobTitle: "x" }, "claude")).toThrow(LLMError);
  });
});

describe("sanitizeRewrite", () => {
  it("drops malformed suggestions and requires an improved CV", () => {
    const result = sanitizeRewrite(
      {
        suggestions: [
          { priority: "critical", section: "Skills", original: "a", improved: "b", reason: "c" },
          { priority: "urgent", section: "Summary", original: "a", improved: "b", reason: "c" },
          { priority: "critical", section: "Skills", original: 1 },
        ],
        improvedCv: "# Jane\n",
        unaddressedKeywords: ["GraphQL"],
      },
      "openai"
    );
    expect(result.suggestions).toHaveLength(2);
    // Priority is set later by the scoring engine; whatever the model sends is dropped.
    expect(result.suggestions[0]).toEqual({ section: "Skills", original: "a", improved: "b", reason: "c" });
    expect(result.improvedCv).toBe("# Jane");
    expect(() => sanitizeRewrite({ suggestions: [], improvedCv: " " }, "openai")).toThrow(LLMError);
  });
});

describe("sanitizeRewrite filters", () => {
  // Both cases came back from a live Gemini 2.5 Flash rewrite.
  const skills = "Go, Python, SQL, Docker, AWS";
  const faked = `${skills}, Message Queues (simulated)`;

  it("drops placeholder claims and reverts them in the improved CV", () => {
    const result = sanitizeRewrite(
      {
        suggestions: [{ section: "Skills", original: skills, improved: faked, reason: "Adds a placeholder" }],
        improvedCv: `# Alex\n## Skills\n${faked}`,
        unaddressedKeywords: [],
      },
      "gemini"
    );
    expect(result.suggestions).toEqual([]);
    expect(result.improvedCv).toBe(`# Alex\n## Skills\n${skills}`);
  });

  it("drops changes an ATS reads the same way", () => {
    const result = sanitizeRewrite(
      {
        suggestions: [
          { section: "Experience", original: "BACKEND DEVELOPER iNTERN Feb. 2024 - Sep. 2024", improved: "BACKEND DEVELOPER INTERN Feb 2024 – Sep 2024", reason: "r" },
          { section: "Experience", original: "Sep. 2024 - Mar. 2026", improved: "September 2024 – March 2026", reason: "r" },
          { section: "Summary", original: "Backend developer", improved: "Backend developer building Go microservices", reason: "r" },
        ],
        improvedCv: "# Alex",
        unaddressedKeywords: [],
      },
      "gemini"
    );
    expect(result.suggestions.map((suggestion) => suggestion.section)).toEqual(["Summary"]);
  });
});

describe("extractRequirements", () => {
  it("caches per provider and job post", async () => {
    const generateJson = vi.fn().mockResolvedValue(FRONTEND_JOB);
    const client: LLMClient = { generateJson };
    const post = `Senior Frontend Engineer ${Math.random()}`;

    const first = await extractRequirements(client, "claude", post);
    const second = await extractRequirements(client, "claude", `${post}\n`);
    await extractRequirements(client, "gemini", post);

    expect(second).toBe(first);
    expect(generateJson).toHaveBeenCalledTimes(2);
  });
});

describe("parseJsonObject", () => {
  it("tolerates code fences and rejects non-JSON", () => {
    expect(parseJsonObject('```json\n{"a":1}\n```', "gemini")).toEqual({ a: 1 });
    expect(() => parseJsonObject("no json here", "gemini")).toThrow(LLMError);
  });
});

describe("buildRewritePrompt", () => {
  it("lists missing required keywords first and failed checks", () => {
    const prompt = buildRewritePrompt(WEAK_CV, "job post", scoreCv(WEAK_CV, FRONTEND_JOB));
    const missing = prompt.slice(prompt.indexOf("does not contain:"));
    expect(missing.indexOf("React (required)")).toBeLessThan(missing.indexOf("Jest (preferred)"));
    expect(prompt).toContain("Skills section:");
  });

  it("tells the model that garbled capitals are extraction artefacts, not typos", () => {
    const cv = `${WEAK_CV}\nBACKEND DEVELOPER iNTERN Feb. 2024 - Sep. 2024`;
    expect(buildRewritePrompt(cv, "job post", scoreCv(cv, FRONTEND_JOB))).toContain('"iNTERN" comes from that extraction');
    expect(buildRewritePrompt(WEAK_CV, "job post", scoreCv(WEAK_CV, FRONTEND_JOB))).not.toContain("extraction");
  });
});
