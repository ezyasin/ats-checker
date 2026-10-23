import { describe, expect, it } from "vitest";
import { countWords, diffWords } from "./textDiff";

describe("diffWords", () => {
  it("marks added and removed words", () => {
    const parts = diffWords("Built REST APIs in Go", "Built REST APIs and microservices in Go");
    expect(parts).toEqual([
      { type: "same", text: "Built REST APIs " },
      { type: "added", text: "and microservices" },
      { type: "same", text: " in Go" },
    ]);
    expect(countWords(parts, "added")).toBe(2);
  });

  it("ignores case, punctuation and line breaks", () => {
    const parts = diffWords("BACKEND DEVELOPER Sep. 2024 Mar. 2026", "Backend Developer\nSep 2024 – March 2026");
    expect(parts.every((part) => part.type === "same")).toBe(true);
  });

  it("reports removals in place", () => {
    const parts = diffWords("Go, Python, Kafka, AWS", "Go, Python, AWS");
    expect(parts.find((part) => part.type === "removed")?.text).toBe("Kafka,");
    expect(parts.filter((part) => part.type !== "removed").map((part) => part.text).join("")).toBe("Go, Python, AWS");
  });
});
