import { describe, expect, it } from "vitest";
import { cvToMarkdown, parseCv } from "./cvModel";
import { dropInventedBullets, preserveOriginal, restoreContact, restoreSections } from "./preserveCv";

// Text as extracted from an Awesome-CV PDF: icon names, lost dashes, page footers.
const ORIGINAL = `Alex MorganBackend Developer
Kadıköy, Istanbul, Turkey
PHONE +90 555 000 0000 | ENVELOPE alex@example.com | GITHUB-SQUARE alexmorgan
“Make it work, then make it right.”
Summary
Backend developer building REST APIs in Go and PostgreSQL.
Work Experience
Northwind Logistics Istanbul, Turkey
Backend Developer Sep. 2024 Mar. 2026
• Designed and built 14 REST endpoints in Go serving the warehouse
dashboard.
• Cut p95 latency from 800 ms to 120 ms with PostgreSQL indexes.
Contoso Fintech Ankara, Turkey
Backend Developer Intern Feb. 2024 Sep. 2024
October 1, 2026 Alex Morgan · Résumé 1
Acme Labs Istanbul, Turkey
Junior Developer Jun. 2023 Jan. 2024
• Wrote unit tests with Jest for the billing service.
Honors & Awards
International Awards
2023 Finalist, ACM ICPC Regional Contest Bucharest, Romania
2022 3rd Place, Global Game Jam
Community
2022 Organizer of Go Istanbul Meetup
Education
Middle East Technical University Ankara, Turkey
B.S. in Computer Engineering Sep. 2020 Jun. 2024`;

const REWRITE = `# Alex Morgan
Backend Developer
+90 555 000 0000 | alex@example.com | github.com/alexmorgan

## Summary

Backend developer building REST APIs in Go and PostgreSQL.

## Experience

### Backend Developer
Northwind Logistics | Istanbul | Sep 2024 – Mar 2026
- Designed and built 14 REST endpoints in Go for the warehouse dashboard.
- Cut p95 latency from 800 ms to 120 ms with PostgreSQL indexes.

### Backend Developer Intern
Contoso Fintech | Ankara | Feb 2024 – Sep 2024
- Contributed to backend engineering efforts within the organization.

### Junior Developer
Acme Labs | Istanbul | Jun 2023 – Jan 2024
- Wrote unit tests with Jest for the billing service.

## Education

### B.S. in Computer Engineering
Middle East Technical University | Ankara | Sep 2020 – Jun 2024`;

describe("dropInventedBullets", () => {
  it("empties a role the original lists without bullets", () => {
    const model = dropInventedBullets(parseCv(REWRITE), ORIGINAL);
    const entries = model.sections[1].blocks.flatMap((block) => (block.type === "entry" ? [block.entry] : []));
    expect(entries.map((entry) => entry.bullets.length)).toEqual([2, 0, 1]);
  });

  it("leaves bullets alone when the original's dates don't sit with its roles", () => {
    // Two-column layouts extract every date together, after the bullets.
    const columns = `Northwind Logistics\n• Built REST endpoints in Go.\nContoso Fintech\n• Built an admin API.\nSep. 2024 Mar. 2026\nFeb. 2024 Sep. 2024`;
    const model = parseCv(REWRITE);
    expect(dropInventedBullets(model, columns)).toEqual(model);
  });
});

describe("restoreContact", () => {
  it("puts back a dropped location first, without icon names or the motto", () => {
    const model = restoreContact(parseCv(REWRITE), ORIGINAL);
    expect(model.contact).toEqual(["Kadıköy, Istanbul, Turkey", "+90 555 000 0000", "alex@example.com", "github.com/alexmorgan"]);
  });
});

describe("restoreSections", () => {
  it("appends sections the rewrite left out, with their original lines", () => {
    const markdown = cvToMarkdown(restoreSections(parseCv(REWRITE), ORIGINAL));
    expect(markdown).toContain(
      "## Honors & Awards\n\nInternational Awards\n\n- 2023 Finalist, ACM ICPC Regional Contest Bucharest, Romania\n- 2022 3rd Place, Global Game Jam"
    );
    expect(markdown).toContain("## Community\n\n- 2022 Organizer of Go Istanbul Meetup");
    expect(markdown).not.toContain("Résumé 1");
  });

  it("doesn't duplicate a section the rewrite kept under another name", () => {
    const kept = `${REWRITE}\n\n## Awards\n\n- 2023 Finalist, ACM ICPC Regional Contest\n\n## Community\n\n- 2022 Organizer of Go Istanbul Meetup`;
    const model = restoreSections(parseCv(kept), ORIGINAL);
    expect(model.sections.map((section) => section.heading)).toEqual(["Summary", "Experience", "Education", "Awards", "Community"]);
  });
});

describe("preserveOriginal", () => {
  it("does nothing without an original", () => {
    const model = parseCv(REWRITE);
    expect(preserveOriginal(model, "")).toBe(model);
  });
});
