import type { AnalysisResult } from "@/types/analysis";
import type { Verdict } from "@/lib/scoring/types";

/**
 * /api/analyze answers with newline-delimited JSON: one event per line, sent
 * as each server step starts, so the client can show real progress instead
 * of a timer.
 */
export type AnalysisStage = "parse" | "requirements" | "score" | "rewrite";

export type AnalysisEvent =
  | { type: "stage"; stage: AnalysisStage }
  | { type: "score"; total: number; verdict: Verdict }
  | { type: "result"; result: AnalysisResult }
  | { type: "error"; error: string };

export const ANALYSIS_STREAM_CONTENT_TYPE = "application/x-ndjson";

export function encodeEvent(event: AnalysisEvent): string {
  return `${JSON.stringify(event)}\n`;
}

/** Reads an NDJSON body and calls `onEvent` for every complete line. */
export async function readEvents(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: AnalysisEvent) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const flush = (final: boolean) => {
    const lines = buffer.split("\n");
    buffer = final ? "" : lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) onEvent(JSON.parse(line) as AnalysisEvent);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    flush(false);
  }
  buffer += decoder.decode();
  flush(true);
}

/**
 * Each stage owns a slice of the bar. Inside a slice the bar eases toward the
 * end but never reaches it: only the server reporting the next stage moves
 * the bar past a slice boundary. Timings come from live Gemini 2.5 Flash
 * runs: about 4s to read the job post and 20s to rewrite the CV.
 */
export const STAGE_PLAN: { stage: AnalysisStage; start: number; end: number; expectedMs: number }[] = [
  { stage: "parse", start: 0, end: 5, expectedMs: 1500 },
  { stage: "requirements", start: 5, end: 25, expectedMs: 4000 },
  { stage: "score", start: 25, end: 28, expectedMs: 300 },
  { stage: "rewrite", start: 28, end: 97, expectedMs: 15000 },
];

export interface AnalysisProgressState {
  startedAt: number;
  stage: AnalysisStage;
  stageStartedAt: number;
  /** How long each finished stage took, in ms. */
  durations: Partial<Record<AnalysisStage, number>>;
  score: { total: number; verdict: Verdict } | null;
  done: boolean;
}

export function startProgress(now: number): AnalysisProgressState {
  return { startedAt: now, stage: "parse", stageStartedAt: now, durations: {}, score: null, done: false };
}

function stageIndex(stage: AnalysisStage) {
  return STAGE_PLAN.findIndex((plan) => plan.stage === stage);
}

/** Moves to `stage`, marking it and every stage before it as finished. */
export function advanceProgress(
  state: AnalysisProgressState,
  stage: AnalysisStage,
  now: number
): AnalysisProgressState {
  const target = stageIndex(stage);
  if (target <= stageIndex(state.stage)) return state;

  const durations = { ...state.durations, [state.stage]: now - state.stageStartedAt };
  for (const plan of STAGE_PLAN.slice(stageIndex(state.stage) + 1, target)) {
    durations[plan.stage] = 0;
  }
  return { ...state, stage, stageStartedAt: now, durations };
}

export function completeProgress(state: AnalysisProgressState, now: number): AnalysisProgressState {
  return { ...state, durations: { ...state.durations, [state.stage]: now - state.stageStartedAt }, done: true };
}

export function progressValue(state: AnalysisProgressState, now: number): number {
  if (state.done) return 100;
  const plan = STAGE_PLAN[stageIndex(state.stage)];
  const elapsed = Math.max(0, now - state.stageStartedAt);
  const eased = 1 - Math.exp(-elapsed / plan.expectedMs);
  return Math.round(plan.start + (plan.end - plan.start) * eased);
}

/** True once a stage has run well past its usual time, e.g. a busy provider. */
export function isStageSlow(state: AnalysisProgressState, now: number): boolean {
  const plan = STAGE_PLAN[stageIndex(state.stage)];
  return !state.done && now - state.stageStartedAt > plan.expectedMs * 2.5;
}
