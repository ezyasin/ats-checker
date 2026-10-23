# ATS Checker

ATS Checker is a Next.js app that scores a CV against a real reference job post instead of generating a generic upload-only score. It analyzes ATS fit, highlights matched and missing keywords, suggests targeted rewrites, and lets the user export an improved version of the resume.

The app is built for role-specific resume optimization. A CV upload alone is not enough here; the current flow requires a job post so the score, rewrite suggestions, and keyword analysis stay grounded in a real target role.

## Quick Visual

### Analyze Workspace

![ATS Checker analyze workspace with aligned CV upload and reference job post inputs](./public/readme/analyze-workspace.png)

### Live Progress

![ATS Checker live analysis progress with staged upload and processing feedback](./public/readme/analysis-progress.png)

### Results Dashboard

![ATS Checker results dashboard with ATS score, keyword gaps, and rewrite suggestions](./public/readme/results-dashboard.png)

These screenshots reflect the current job-post-based flow: upload a CV, paste a real target job post, track staged analysis progress, then review the score and rewrite suggestions.

## How Scoring Works

The score is computed by fixed rules, not by an AI model, so the same CV and job post always get the same score:

1. An LLM reads the job post once and extracts structured requirements: title, keywords (required or preferred), minimum years and minimum degree. The result is cached per job post.
2. `lib/scoring` scores the CV against those requirements: keyword match (45 pts), structure & parsing (20), years of experience (15), job title (10) and education (10). Every point is shown in the results breakdown.
3. The LLM rewrites the CV around the gaps the engine found, without inventing skills, and the rewrite is scored by the same engine.

See [ROADMAP.md](./ROADMAP.md) for what's next.

## What The App Does

- Upload a PDF, DOCX, or LaTeX (.tex) CV
- Paste a reference job post
- Run analysis with Claude, Gemini, or OpenAI
- Show ATS score, verdict, keyword gaps, and section scores
- Generate rewrite suggestions and an improved CV
- Show the raw text an ATS reads from the file, with extraction problems highlighted
- Let you correct the extracted job requirements and re-score instantly
- Show a CV diff and export tools
- Write a cover letter from the CV and job post, and download it as DOCX or text
- Export the optimized CV as DOCX, LaTeX (.tex), or plain text

## Main Features

- Job-post-based ATS scoring only
- Guided analyze workspace with aligned CV upload and reference job post inputs
- Readiness checks before analysis starts
- Live analysis progress with staged upload and processing feedback
- Matched and missing keyword breakdown
- Role-specific rewrite suggestions, ranked by the scoring engine, with every added keyword backed by a quote from the CV
- "What the ATS sees" view of the extracted text, with warnings for garbled words, letter-spaced headings and icon fonts
- Editable job requirements with instant in-browser re-scoring
- Cover letter generation that only uses facts from the CV
- Improved CV preview and line-by-line diff
- DOCX export and plain-text export
- In-session improvement history
- Provider selector when multiple AI providers are configured

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- Zustand for client state
- Recharts for score/history visualizations
- `mammoth`, `pdfjs-dist`, and `unpdf` for document parsing
- `docx` for export generation

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template:

```bash
cp env.example .env.local
```

3. Add at least one AI provider API key in `.env.local`

4. Start the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

The project reads these variables:

- `LLM_PROVIDER`
  Preferred default provider when more than one is configured.
- `ANTHROPIC_API_KEY`
  Enables Claude.
- `CLAUDE_MODEL`
  Optional Claude model override. Defaults to `claude-opus-5-5`. Requires a model that supports structured outputs and effort.
- `GOOGLE_API_KEY`
  Enables Gemini.
- `GEMINI_MODEL`
  Primary Gemini model.
- `GEMINI_FALLBACK_MODEL`
  Gemini fallback model if the primary model is unavailable or rate-limited.
- `OPENAI_API_KEY`
  Enables OpenAI.
- `OPENAI_MODEL`
  Optional OpenAI model override.
- `MAX_FILE_SIZE`
  Max upload size in bytes. Default is `5242880` (5 MB).

At least one provider key is required.

## Supported Inputs And Outputs

- Input formats: PDF, DOCX, LaTeX (.tex)
- Default upload size limit: 5 MB
- Output formats: DOCX, LaTeX (.tex), plain text

## Available Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm test                   # unit tests, no API calls
npm run eval:consistency   # re-extracts requirements N times with a real provider and reports the score spread
```

## Notes

- CVs and job posts are processed in memory and are not stored by the app.
- If you test the app over an insecure local network URL such as `http://192.168.x.x`, Chrome may block generated downloads. Using `localhost` or HTTPS avoids that.
- The improvement history shown in the UI is session-based, not a persistent server-side history.
