# Roadmap

The goal: an ATS score you can trust. The same CV and job post must always get the same score, and every point must be explainable.

## The problem

Until now the score came straight from the LLM (`"Calculate an ATS compatibility score from 0 to 100"`). It was blended with formatting checks that never worked, because they split text on a literal `\\n` string instead of a newline. As a result:

- Running the same CV twice gave different scores.
- Nobody could say *why* a CV scored 64 and not 71.
- Every CV was penalised for "missing section headers" and "no bullet points", whatever it contained.

## The fix in one sentence

The LLM reads the job post and extracts structured requirements. Plain TypeScript does all the scoring. The LLM then only writes rewrites, and the rewritten CV is scored by the same engine.

---

## Phase 0: Cleanup and safety net
- [x] Remove dead modules (`route-enhanced.ts`, `store/analysis-enhanced.ts`, `types/analysis-enhanced.ts`, `lib/validators-enhanced.ts`, `lib/claude.ts`)
- [x] Add a test runner (Vitest) and `npm test`

## Phase 1: Deterministic scoring engine (`lib/scoring/`)
- [x] Text normalisation and section detection (Summary, Experience, Skills, Education, …), including markdown headers
- [x] Keyword matching with word boundaries, plurals, generic suffixes ("GraphQL APIs" matches "GraphQL"), punctuation variants (`Node.js` / `nodejs` / `node js`), a built-in synonym table (`JS` ↔ `JavaScript`, `k8s` ↔ `Kubernetes`, …) and case-sensitive matching for short terms (`Go`, `R`, `C`)
- [x] Years of experience from date ranges (`Jan 2020 – Present`, `03/2018 - 06/2021`, `2019–2022`), with overlapping jobs merged
- [x] Highest degree detection compared with the job's minimum degree
- [x] Job title match: exact title 100; close match 85 (ignores seniority, treats developer/engineer and front-end/frontend as the same, so it doesn't depend on the LLM's alias list); otherwise partial credit per word
- [x] Structure checks: contact info, standard section headers, parseable dates, length, unreadable glyphs
- [x] Weighted total with a per-component breakdown: keywords 45, structure 20, experience 15, title 10, education 10
- [x] Unit tests for every module

## Phase 2: The LLM only extracts and rewrites
- [x] Provider clients become thin JSON adapters (Claude, Gemini, OpenAI) with structured output and typed errors
- [x] Call 1: extract `JobRequirements` from the job post (cached per job post, so re-runs reuse the same requirements)
- [x] Call 2: rewrite the CV, targeting the gaps the engine found, and never inventing skills
- [x] Re-score the improved CV with the same engine, giving a "54 → 78" before/after

## Phase 3: Prove it
- [x] Fixture CVs and job posts with expected score ranges (tests)
- [x] `npm run eval:consistency`: re-extract requirements N times with a real provider and report the score spread. First result (Gemini 2.5 Flash, 5 fresh extractions): **spread 0** for the strong, mid and weak CVs
- [ ] Run the eval against Claude and OpenAI once their keys are set
- [ ] More job-post fixtures (non-tech roles: sales, nursing, finance) so the eval covers more than one kind of post
- [ ] PDF fixtures (single column, two column, icon fonts) to check what text extraction actually produces

## Phase 4: Tailor the UI
- [x] Results page explains the score: each component, its points, and the checks behind it
- [x] Keywords grouped by required vs preferred, with the alias that matched; hover shows where each one was found
- [x] Note listing missing keywords the rewrite left out because the CV shows no evidence for them
- [x] Before → after score for the improved CV
- [x] "What the ATS sees": the raw extracted text split into recognised sections, with warnings and highlights for garbled words (`iNTERN`, Turkish dotted İ), letter-spaced headings and icon-font glyphs
- [x] Editable requirements: fix the job title, years, degree or keywords, and both CVs re-score and suggestions re-rank instantly in the browser (no LLM call)
- [x] Trim the tab clutter: "ATS Tips" replaced by the ATS view (with a short, accurate tips list); Export merged into the Improved CV tab
- [ ] Replace hard-coded `gray-*` / `text-red-600` colours with theme tokens so dark mode works everywhere
- [ ] Mobile pass on the results page (tabs currently overflow on small screens)

## Phase 5: Honest rewrites
- [x] Rewrite prompt forbids inventing skills, upgrading claims ("fixed accessibility issues" ≠ "WCAG compliance") or changing job titles and seniority. Verified on a live run
- [x] Suggestion priority comes from the scoring engine (critical = adds a required keyword, important = preferred keyword or structure fix, optional = wording), not from the model
- [x] Every keyword the rewrite adds must quote CV text as evidence; quotes are checked against the CV, and unproven additions are reverted or left unscored and flagged. A live run had added Kafka, Kubernetes, RabbitMQ and GCP with no evidence
- [x] Placeholder claims ("simulated", "[add metric]"), cosmetic-only changes (`Sep. 2024` → `Sep 2024`) and repeated suggestions are dropped
- [ ] Mark suggestions whose "original" text doesn't exist in the CV (the LLM paraphrased) and hide or fix them
- [ ] "Do you have this skill?" checklist for missing required keywords, fed back into the rewrite
- [ ] Keep the user's own wording where possible; show the rewrite as accept/reject per suggestion

## Phase 6: Later
- [x] Cover letter generation from the same requirements (only skills the CV shows; no placeholders)
- [ ] Browser extension: score a LinkedIn or Indeed job post against a saved CV in one click
- [ ] Non-English CVs: section headers and degree names (e.g. Turkish "Deneyim", "Lisans"). Turkish dotted/dotless i is already normalised
- [ ] Deploy (Cloudflare or Vercel). `proxy.ts` already rate-limits `/api/analyze`, but in memory, like the requirements cache. Both need a shared store (KV or Redis) once there's more than one server instance
- [x] Show progress for the two LLM steps (extraction, rewrite) in the analyze page instead of a timed animation. The API streams each step as it starts, and the first score appears before the rewrite finishes
