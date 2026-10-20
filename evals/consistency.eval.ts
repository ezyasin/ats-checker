/**
 * Measures how much the score moves when the LLM re-extracts requirements
 * from the same job post. Scoring itself is deterministic, so this spread is
 * entirely extraction variance. Calls a real provider; costs a few requests.
 *
 *   npm run eval:consistency            # default provider, 5 runs
 *   EVAL_RUNS=10 LLM_PROVIDER=gemini npm run eval:consistency
 */
import { expect, it } from "vitest";
import { createLLMClient, getDefaultProvider } from "@/lib/llm/factory";
import { extractRequirements } from "@/lib/llm/tasks";
import { scoreCv } from "@/lib/scoring";
import { FRONTEND_JOB_POST, MID_CV, STRONG_CV, WEAK_CV } from "@/lib/scoring/fixtures";

const RUNS = Number(process.env.EVAL_RUNS ?? 5);
const MAX_SPREAD = Number(process.env.EVAL_MAX_SPREAD ?? 5);
const CVS = { strong: STRONG_CV, mid: MID_CV, weak: WEAK_CV };

it(`score spread across ${RUNS} fresh extractions stays within ${MAX_SPREAD} points`, async () => {
  const provider = getDefaultProvider();
  const client = createLLMClient(provider);
  const now = new Date();

  const scores: Record<string, number[]> = { strong: [], mid: [], weak: [] };
  const keywordSets: string[] = [];

  for (let run = 0; run < RUNS; run++) {
    const requirements = await extractRequirements(client, provider, FRONTEND_JOB_POST, { useCache: false });
    keywordSets.push(requirements.keywords.map((keyword) => keyword.term.toLowerCase()).sort().join(", "));
    for (const [name, cv] of Object.entries(CVS)) {
      scores[name].push(scoreCv(cv, requirements, { now }).total);
    }
  }

  console.log(`\nProvider: ${provider}, ${RUNS} fresh extractions`);
  for (const [name, values] of Object.entries(scores)) {
    const spread = Math.max(...values) - Math.min(...values);
    console.log(`  ${name.padEnd(6)} ${values.join(", ").padEnd(30)} spread ${spread}`);
  }
  const distinct = [...new Set(keywordSets)];
  console.log(`  ${distinct.length} distinct keyword set(s):`);
  distinct.forEach((set) => console.log(`    - ${set}`));

  for (const values of Object.values(scores)) {
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(MAX_SPREAD);
  }
}, 600_000);
