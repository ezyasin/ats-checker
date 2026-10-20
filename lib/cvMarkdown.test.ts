import { describe, expect, it } from "vitest";
import { cvToPlainText, parseCvMarkdown, parseInline } from "./cvMarkdown";
import { generateDocx } from "./exporters/docx";
import { generateLatex } from "./exporters/latex";

// Shaped like a real Gemini rewrite: bold job titles mid-line, a bold label, a rule.
const CV = `# Jane Doe
jane.doe@example.com | +1 (555) 123-4567

## Experience
**Frontend Developer**, Acme Corp
Jan 2021 – Present
- Rebuilt the dashboard in **React** and Redux
* Wrote unit tests with Jest

---
## Skills
**Languages:** JavaScript, TypeScript`;

describe("parseInline", () => {
  it("splits bold spans anywhere in a line", () => {
    expect(parseInline("**Frontend Developer**, Acme Corp")).toEqual([
      { text: "Frontend Developer", bold: true },
      { text: ", Acme Corp", bold: false },
    ]);
    expect(parseInline("plain")).toEqual([{ text: "plain", bold: false }]);
  });
});

describe("parseCvMarkdown", () => {
  it("recognises headings, both bullet styles and rules", () => {
    const types = parseCvMarkdown(CV).map((block) => block.type);
    expect(types).toEqual([
      "heading", "paragraph", "blank",
      "heading", "paragraph", "paragraph", "bullet", "bullet", "blank",
      "blank", "heading", "paragraph",
    ]);
  });

  it("does not mistake a bold line for a bullet", () => {
    expect(parseCvMarkdown("**Skills:** Go")[0].type).toBe("paragraph");
  });
});

describe("cvToPlainText", () => {
  it("removes every markdown marker", () => {
    const text = cvToPlainText(CV);
    expect(text).not.toMatch(/[#*]|---/);
    expect(text).toContain("Frontend Developer, Acme Corp");
    expect(text).toContain("• Rebuilt the dashboard in React and Redux");
    expect(text.startsWith("Jane Doe\n")).toBe(true);
  });
});

describe("exporters", () => {
  it("writes bold as \\textbf in LaTeX and leaves no markers", () => {
    const tex = generateLatex(CV);
    expect(tex).toContain("\\textbf{Frontend Developer}, Acme Corp");
    expect(tex).toContain("\\textbf{React}");
    expect(tex).toContain("\\section*{Experience}");
    expect(tex).not.toContain("**");
  });

  it("produces a DOCX file", async () => {
    const bytes = await generateDocx(CV);
    // DOCX is a zip archive: "PK" magic bytes.
    expect(Array.from(bytes.slice(0, 2))).toEqual([0x50, 0x4b]);
  });
});
