import type { JobRequirements } from "./types";

export const FRONTEND_JOB: JobRequirements = {
  jobTitle: "Senior Frontend Engineer",
  titleAliases: ["Frontend Developer", "Front-End Engineer"],
  keywords: [
    { term: "React", synonyms: [], category: "hard_skill", importance: "required" },
    { term: "TypeScript", synonyms: [], category: "hard_skill", importance: "required" },
    { term: "Next.js", synonyms: [], category: "tool", importance: "required" },
    { term: "GraphQL", synonyms: [], category: "hard_skill", importance: "required" },
    { term: "Jest", synonyms: [], category: "tool", importance: "preferred" },
    { term: "AWS", synonyms: [], category: "tool", importance: "preferred" },
    { term: "Accessibility", synonyms: ["a11y", "WCAG"], category: "domain", importance: "preferred" },
    { term: "Communication", synonyms: [], category: "soft_skill", importance: "preferred" },
  ],
  minYearsExperience: 5,
  minDegree: "bachelor",
};

export const STRONG_CV = `Jane Doe
jane.doe@example.com | +1 (555) 123-4567 | linkedin.com/in/janedoe

Professional Summary
Senior Frontend Engineer with 7 years building React and TypeScript applications.

Experience
Senior Frontend Engineer, Acme Corp
Jan 2021 – Present
• Led migration of a 200-page app to Next.js and GraphQL, cutting load time by 40%
• Introduced Jest and React Testing Library, raising coverage from 35% to 85%
• Shipped WCAG 2.1 AA accessibility fixes across the design system

Frontend Developer, Beta Ltd
Mar 2018 – Dec 2020
• Built customer dashboards in React.js and TypeScript
• Deployed static sites to Amazon Web Services (S3, CloudFront)
• Presented quarterly roadmaps; strong written and verbal communication

Skills
React, TypeScript, Next.js, GraphQL, Jest, AWS, HTML, CSS, Node.js

Education
B.Sc. Computer Science, State University, 2014 – 2018
`;

export const WEAK_CV = `John Smith
john@example.com

About me
I like computers and have done some websites.

Work History
Web Designer, Small Agency
2022 - 2024
- Designed WordPress themes with PHP and jQuery
- Managed client emails

Hobbies
Chess, hiking
`;

/** What a two-column PDF with an icon font often extracts as: no headings, no dates. */
export const BROKEN_PARSE_CV = `Jane Doe  jane.doe@example.com    React TypeScript
Senior Frontend Engineer Acme Corp Led migration Next.js  GraphQL `;

/** A real-world shaped job post, for evals that call an LLM. */
export const FRONTEND_JOB_POST = `Senior Frontend Engineer - Remote

We're looking for a Senior Frontend Engineer to lead our web platform.

Requirements:
- 5+ years of professional frontend experience
- Expert in React and TypeScript
- Experience with Next.js and server-side rendering
- Experience consuming GraphQL APIs
- Strong understanding of web accessibility (WCAG)
- Bachelor's degree in Computer Science or equivalent experience

Nice to have:
- Testing with Jest or Playwright
- AWS experience
- Design systems experience
`;

/** Partial match: right role, missing half the stack. */
export const MID_CV = `Jane Doe
jane.doe@example.com | +1 (555) 123-4567

Professional Summary
Frontend developer with 6 years building web apps in React and JavaScript.

Experience
Frontend Developer, Acme Corp
Jan 2021 – Present
• Rebuilt the customer dashboard in React and Redux, cutting load time by 40%
• Wrote unit tests with Jest and React Testing Library
• Worked with designers to fix accessibility issues found in audits

Web Developer, Beta Ltd
Mar 2018 – Dec 2020
• Built marketing sites with jQuery, Sass and PHP
• Moved static assets to Amazon S3 and CloudFront

Skills
JavaScript, React, Redux, HTML, CSS, Sass, Jest, Git

Education
B.Sc. Computer Science, State University, 2014 – 2018
`;
