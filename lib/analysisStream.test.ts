import { describe, expect, it } from "vitest";
import {
  STAGE_PLAN,
  advanceProgress,
  completeProgress,
  encodeEvent,
  isStageSlow,
  progressValue,
  readEvents,
  startProgress,
  type AnalysisEvent,
} from "./analysisStream";

function streamOf(chunks: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe("readEvents", () => {
  it("parses events split across chunks, including a last line without a newline", async () => {
    const text =
      encodeEvent({ type: "stage", stage: "requirements" }) +
      encodeEvent({ type: "score", total: 63, verdict: "Good" }) +
      JSON.stringify({ type: "error", error: "busy" });
    const chunks = [text.slice(0, 7), text.slice(7, 40), text.slice(40)];

    const events: AnalysisEvent[] = [];
    await readEvents(streamOf(chunks), (event) => events.push(event));

    expect(events).toEqual([
      { type: "stage", stage: "requirements" },
      { type: "score", total: 63, verdict: "Good" },
      { type: "error", error: "busy" },
    ]);
  });
});

describe("progress", () => {
  it("records durations and marks skipped stages as done", () => {
    const start = startProgress(0);
    const next = advanceProgress(start, "score", 5000);
    expect(next.stage).toBe("score");
    expect(next.durations).toEqual({ parse: 5000, requirements: 0 });
    // Stages never move backwards.
    expect(advanceProgress(next, "parse", 6000)).toBe(next);
  });

  it("stays inside the current stage's slice until the server moves on", () => {
    const plan = STAGE_PLAN.find((item) => item.stage === "rewrite")!;
    const state = advanceProgress(startProgress(0), "rewrite", 1000);

    expect(progressValue(state, 1000)).toBe(plan.start);
    const later = progressValue(state, 1000 + plan.expectedMs);
    expect(later).toBeGreaterThan(plan.start);
    expect(later).toBeLessThan(plan.end);
    expect(progressValue(state, 1000 + plan.expectedMs * 100)).toBeLessThanOrEqual(plan.end);
    expect(progressValue(completeProgress(state, 2000), 2000)).toBe(100);
  });

  it("flags a stage that runs well past its usual time", () => {
    const plan = STAGE_PLAN.find((item) => item.stage === "requirements")!;
    const state = advanceProgress(startProgress(0), "requirements", 0);
    expect(isStageSlow(state, plan.expectedMs)).toBe(false);
    expect(isStageSlow(state, plan.expectedMs * 3)).toBe(true);
  });
});
