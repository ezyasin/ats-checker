import { describe, expect, it } from "vitest";
import {
  canonicalCv,
  casingVocabulary,
  cvFromFields,
  cvModelToPlainText,
  cvToMarkdown,
  formatDateRange,
  normalizeCv,
  parseCv,
  recase,
} from "./cvModel";

// What Gemini returned for the Awesome-CV example before the structured schema.
const LOOSE = `# ALEX MORGAN
alex.morgan@example.com | +90 555 000 0000 | github.com/alexmorgan

## Summary

Backend developer with 2 years of experience building REST APIs in Go and PostgreSQL.

## Experience

BACKEND DEVELOPER Sep. 2024 - Mar. 2026

Northwind Logistics, Istanbul

- Designed and built 14 REST endpoints in Go.

BACKEND DEVELOPER iNTERN Feb. 2024 Sep. 2024

Contoso Fintech, Ankara

- Built an internal admin API in Node.js.

## Education

BACHELOR'S DEGREE IN COMPUTER ENGINEERING Sep. 2020 - Jun. 2024

Middle East Technical University`;

describe("recase", () => {
  it("turns text in capitals into title case and leaves normal text alone", () => {
    expect(recase("BACKEND DEVELOPER INTERN")).toBe("Backend Developer Intern");
    expect(recase("BACHELOR'S DEGREE IN COMPUTER ENGINEERING")).toBe("Bachelor's Degree in Computer Engineering");
    expect(recase("Backend Developer")).toBe("Backend Developer");
    expect(recase("AWS")).toBe("AWS");
  });

  it("reads the Turkish İ signature as capitals", () => {
    expect(recase("BACKEND DEVELOPER iNTERN")).toBe("Backend Developer Intern");
    expect(recase("İSTANBUL")).toBe("İstanbul");
  });

  it("keeps acronyms and the CV's own spelling of words", () => {
    const vocabulary = casingVocabulary("Built APIs with PostgreSQL and JavaScript");
    expect(recase("SENIOR JAVASCRIPT ENGINEER, IT AND WEB", vocabulary)).toBe("Senior JavaScript Engineer, IT and Web");
    expect(recase("FRONT-END DEVELOPER")).toBe("Front-End Developer");
  });
});

describe("formatDateRange", () => {
  it("writes every date the same way", () => {
    expect(formatDateRange("Sep. 2024", "Mar. 2026")).toBe("Sep 2024 – Mar 2026");
    expect(formatDateRange("09/2024", "current")).toBe("Sep 2024 – Present");
    expect(formatDateRange("September 2024 - Present")).toBe("Sep 2024 – Present");
    expect(formatDateRange("2019", "2022")).toBe("2019 – 2022");
    expect(formatDateRange("", "Jun 2024")).toBe("Jun 2024");
  });
});

describe("parseCv", () => {
  it("finds entries in loose markdown and normalizes them", () => {
    const model = normalizeCv(parseCv(LOOSE), LOOSE);
    expect(model.name).toBe("Alex Morgan");
    expect(model.contact).toEqual(["alex.morgan@example.com", "+90 555 000 0000", "github.com/alexmorgan"]);
    const experience = model.sections.find((section) => section.heading === "Experience")!;
    expect(experience.blocks.map((block) => block.type === "entry" && block.entry)).toEqual([
      {
        title: "Backend Developer",
        organization: "Northwind Logistics",
        location: "Istanbul",
        dates: "Sep 2024 – Mar 2026",
        details: [],
        bullets: ["Designed and built 14 REST endpoints in Go."],
      },
      {
        title: "Backend Developer Intern",
        organization: "Contoso Fintech",
        location: "Ankara",
        dates: "Feb 2024 – Sep 2024",
        details: [],
        bullets: ["Built an internal admin API in Node.js."],
      },
    ]);
    const education = model.sections.find((section) => section.heading === "Education")!;
    expect(education.blocks[0]).toMatchObject({
      entry: { title: "Bachelor's Degree in Computer Engineering", organization: "Middle East Technical University" },
    });
  });

  it("reads a bold title with the dates on the next line", () => {
    const model = parseCv("# Jane\n\n## Experience\n**Frontend Developer**, Acme Corp\nJan 2021 – Present\n- Rebuilt the dashboard");
    expect(model.sections[0].blocks[0]).toEqual({
      type: "entry",
      entry: {
        title: "Frontend Developer",
        organization: "Acme Corp",
        location: "",
        dates: "Jan 2021 – Present",
        details: [],
        bullets: ["Rebuilt the dashboard"],
      },
    });
  });

  it("round-trips canonical markdown", () => {
    const canonical = canonicalCv(LOOSE, LOOSE);
    expect(canonicalCv(canonical, LOOSE)).toBe(canonical);
    expect(canonical).toContain("### Backend Developer\nNorthwind Logistics | Istanbul | Sep 2024 – Mar 2026");
  });

  it("keeps a summary that mentions dates as prose", () => {
    const model = parseCv("# Jane\n\n## Summary\nDeveloper since Jan 2020 – Present, building APIs for logistics and payments.");
    expect(model.sections[0].blocks[0].type).toBe("paragraph");
  });
});

describe("cvFromFields", () => {
  const fields = {
    name: "YASIN PERIHAN",
    headline: "BACKEND DEVELOPER",
    contact: ["ENVELOPE yasin@example.com", "GITHUB-SQUARE github.com/ezyasin", "☎ +90 555 000 0000", "ISTANBUL, TURKEY"],
    sections: [
      { heading: "SUMMARY", paragraph: "Backend developer working with Go.", items: [], entries: [] },
      {
        heading: "Experience",
        paragraph: "",
        items: [],
        entries: [
          {
            title: "Backend Developer",
            organization: "Northwind",
            location: "",
            startDate: "Sep. 2024",
            endDate: "present",
            bullets: ["• Cut p95 latency from 480ms to 120ms"],
          },
        ],
      },
      { heading: "Skills", paragraph: "", items: ["Languages: Go, SQL"], entries: [] },
      { heading: "Projects", paragraph: "", items: [], entries: [] },
    ],
  };

  it("cleans the fields and drops empty sections", () => {
    const model = normalizeCv(cvFromFields(fields)!);
    expect(model.name).toBe("Yasin Perihan");
    expect(model.headline).toBe("Backend Developer");
    expect(model.contact).toEqual(["yasin@example.com", "github.com/ezyasin", "+90 555 000 0000", "Istanbul, Turkey"]);
    expect(model.sections.map((section) => section.heading)).toEqual(["Summary", "Experience", "Skills"]);
    expect(cvToMarkdown(model)).toContain("### Backend Developer\nNorthwind | Sep 2024 – Present\n- Cut p95 latency");
  });

  it("drops subheadings the fields put above award entries", () => {
    const award = (title: string) => ({ title, organization: "", location: "", startDate: "2021", endDate: "", bullets: [] });
    const model = normalizeCv(
      cvFromFields({
        name: "Alex",
        sections: [
          {
            heading: "Honors & Awards",
            paragraph: "",
            items: ["International Awards", "Domestic Awards"],
            entries: [award("2nd Place, AWS GameDay"), award("Finalist, DEFCON CTF")],
          },
          { heading: "Skills", paragraph: "", items: ["Go", "Python"], entries: [] },
        ],
      })!
    );
    expect(model.sections[0].blocks.map((block) => block.type)).toEqual(["entry", "entry"]);
    expect(model.sections[1].blocks).toHaveLength(2);
  });

  it("writes plain text without markers", () => {
    const text = cvModelToPlainText(normalizeCv(cvFromFields(fields)!));
    expect(text).not.toMatch(/[#*]/);
    expect(text).toContain("EXPERIENCE\n\nBackend Developer\nNorthwind | Sep 2024 – Present\n• Cut p95 latency");
  });
});
