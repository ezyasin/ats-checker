export function buildAnalysisPrompt(
  cvText: string,
  jobDescription: string
): string {
  return `You are an expert ATS (Applicant Tracking System) analyst with deep knowledge of how ATS software parses and ranks resumes. Analyze the following CV against the job description.

## JOB DESCRIPTION:
${jobDescription}

## CV:
${cvText}

## INSTRUCTIONS:
1. Calculate an ATS compatibility score from 0 to 100.
2. Identify keywords from the job description that are present in the CV (matched) and those that are missing.
3. Score each major resume section (summary, skills, experience, education) from 0 to 100.
4. Provide specific, actionable improvement suggestions with exact text rewrites.
5. Generate a complete improved version of the CV in markdown format.

Respond ONLY with valid JSON matching this exact structure (no markdown code fences, no extra text):
{
  "atsScore": <number 0-100>,
  "verdict": "<Poor | Fair | Good | Excellent>",
  "matchedKeywords": ["keyword1", "keyword2"],
  "missingKeywords": ["keyword1", "keyword2"],
  "sectionScores": {
    "summary": <number 0-100>,
    "skills": <number 0-100>,
    "experience": <number 0-100>,
    "education": <number 0-100>
  },
  "suggestions": [
    {
      "priority": "<critical | important | optional>",
      "section": "<section name>",
      "original": "<current text from CV>",
      "improved": "<suggested rewrite>",
      "reason": "<why this improves ATS score>"
    }
  ],
  "improvedCv": "<full improved CV in markdown format>"
}

Scoring guidelines:
- 0-30: Poor — major keyword gaps, bad formatting, missing sections
- 31-60: Fair — some keywords match but significant improvements needed
- 61-80: Good — solid match with room for optimization
- 81-100: Excellent — strong ATS compatibility

Be specific in suggestions. Reference exact phrases from the CV to replace. Prioritize critical improvements that would have the most impact on ATS score.`;
}
