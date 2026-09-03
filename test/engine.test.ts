import test from "node:test";
import * as assert from "node:assert/strict";
import { LoopEngine, type PhaseDefinition } from "../src/engine.js";
import { LoopError } from "../src/errors.js";
import { parseSha256Hex } from "../src/checksum.js";

const DUMMY_SHA = parseSha256Hex("c9e3edcf9d3c16427221490a55e17de7414cb77b3c6653ffa63073cacf81889c");

const CANONICAL_PHASES: readonly PhaseDefinition[] = [
  { id: "INITIALIZE", allowedNext: ["SPEC_GATE", "FAILED"] },
  { id: "SPEC_GATE", allowedNext: ["ISOLATE", "BLOCKED"] },
  { id: "ISOLATE", allowedNext: ["DETECT_STACKS", "BLOCKED", "FAILED"] },
  { id: "DETECT_STACKS", allowedNext: ["PLAN", "FAILED"] },
  { id: "PLAN", allowedNext: ["EXECUTE", "BLOCKED", "FAILED"] },
  { id: "EXECUTE", allowedNext: ["VERIFY", "BLOCKED", "FAILED"] },
  { id: "VERIFY", allowedNext: ["REALITY_CHECK", "EXECUTE", "BLOCKED", "FAILED"] },
  { id: "REALITY_CHECK", allowedNext: ["RELEASE_GATE", "EXECUTE", "BLOCKED", "FAILED"] },
  { id: "RELEASE_GATE", allowedNext: ["COMPLETE", "BLOCKED"] },
  { id: "COMPLETE", allowedNext: [], terminal: true },
  { id: "BLOCKED", allowedNext: [], terminal: true },
  { id: "FAILED", allowedNext: [], terminal: true }
];

test("engine: full canonical path reaches COMPLETE status", () => {
  const engine = new LoopEngine({
    phases: CANONICAL_PHASES,
    initialPhase: "INITIALIZE",
    terminalPhase: "COMPLETE",
    budget: { maxTransitions: 15, maxRetries: 2, maxOperations: 10 },
    goldenSha256: DUMMY_SHA,
    runId: "run-001"
  });

  engine.transition("SPEC_GATE");
  engine.transition("ISOLATE");
  engine.transition("DETECT_STACKS");
  engine.transition("PLAN");
  engine.transition("EXECUTE");
  engine.transition("VERIFY");
  engine.transition("REALITY_CHECK");
  engine.transition("RELEASE_GATE");
  const finalState = engine.transition("COMPLETE");

  assert.equal(finalState.currentPhase, "COMPLETE");
  assert.equal(finalState.status, "succeeded");
  assert.equal(finalState.usage.transitions, 9);
});

test("engine: rejects illegal backwards/skipping transitions", () => {
  const engine = new LoopEngine({
    phases: CANONICAL_PHASES,
    initialPhase: "INITIALIZE",
    terminalPhase: "COMPLETE",
    budget: { maxTransitions: 10, maxRetries: 1, maxOperations: 5 },
    goldenSha256: DUMMY_SHA,
    runId: "run-002"
  });

  assert.throws(
    () => engine.transition("EXECUTE"),
    (err: unknown) => err instanceof LoopError && err.code === "TRANSITION_INVALID"
  );
  assert.equal(engine.snapshot().usage.transitions, 0);
});

test("engine: enforces retry budget boundaries", () => {
  const engine = new LoopEngine({
    phases: CANONICAL_PHASES,
    initialPhase: "INITIALIZE",
    terminalPhase: "COMPLETE",
    budget: { maxTransitions: 10, maxRetries: 1, maxOperations: 5 },
    goldenSha256: DUMMY_SHA,
    runId: "run-003"
  });

  engine.consumeRetry(1);
  assert.equal(engine.snapshot().usage.retries, 1);

  assert.throws(
    () => engine.consumeRetry(1),
    (err: unknown) => err instanceof LoopError && err.code === "BUDGET_EXHAUSTED"
  );
});
