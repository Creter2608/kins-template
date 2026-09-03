import test from "node:test";
import * as assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = process.cwd();
const SCRIPT_PATH = path.join(REPO_ROOT, "scripts", "ai-loop.mjs");

function runAiLoop(args: string[]): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync("node", [SCRIPT_PATH, ...args], {
      cwd: REPO_ROOT,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return { stdout, stderr: "", status: 0 };
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: execErr.stdout ?? "",
      stderr: execErr.stderr ?? "",
      status: execErr.status ?? 1
    };
  }
}

test("ai-loop: rejects state files located within protected .eval/ directory", () => {
  const result = runAiLoop(["init", "--state-file", ".eval/malicious_state.json"]);
  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes("Security invariant violation") || result.stderr.includes("CONFIG_INVALID"));
});

test("ai-loop: full lifecycle from init to transition and verification", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-loop-test-"));
  const stateFile = path.join(tempDir, "test-state.json");

  try {
    // 1. Init
    const initRes = runAiLoop(["init", "--state-file", stateFile, "--run-id", "test-run-42", "--json"]);
    assert.equal(initRes.status, 0, `Init failed: ${initRes.stderr}`);
    const initState = JSON.parse(initRes.stdout);
    assert.equal(initState.runId, "test-run-42");
    assert.equal(initState.currentPhase, "INITIALIZE");
    assert.equal(initState.status, "ready");

    // 2. Status
    const statusRes = runAiLoop(["status", "--state-file", stateFile, "--json"]);
    assert.equal(statusRes.status, 0);
    const statusState = JSON.parse(statusRes.stdout);
    assert.equal(statusState.runId, "test-run-42");

    // 3. Legal Transition
    const transRes = runAiLoop(["transition", "SPEC_GATE", "--state-file", stateFile, "--json"]);
    assert.equal(transRes.status, 0, `Transition failed: ${transRes.stderr}`);
    const transState = JSON.parse(transRes.stdout);
    assert.equal(transState.currentPhase, "SPEC_GATE");
    assert.equal(transState.status, "running");
    assert.equal(transState.usage.transitions, 1);

    // 4. Illegal Transition (skipping to COMPLETE)
    const illegalRes = runAiLoop(["transition", "COMPLETE", "--state-file", stateFile]);
    assert.equal(illegalRes.status, 1);
    assert.ok(illegalRes.stderr.includes("TRANSITION_INVALID"));

    // 5. Retry budget consumption
    const retry1 = runAiLoop(["retry", "1", "--state-file", stateFile, "--json"]);
    assert.equal(retry1.status, 0);
    const retry1State = JSON.parse(retry1.stdout);
    assert.equal(retry1State.usage.retries, 1);

    const retry2 = runAiLoop(["retry", "1", "--state-file", stateFile, "--json"]);
    assert.equal(retry2.status, 0);
    const retry2State = JSON.parse(retry2.stdout);
    assert.equal(retry2State.usage.retries, 2);

    // 6. Exceeding retry budget
    const retryExhausted = runAiLoop(["retry", "1", "--state-file", stateFile]);
    assert.equal(retryExhausted.status, 1);
    assert.ok(retryExhausted.stderr.includes("BUDGET_EXHAUSTED"));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("ai-loop: verify checks workspace against golden assertions", () => {
  const result = runAiLoop(["verify", "--json"]);
  assert.equal(result.status, 0, `Verify failed: ${result.stderr}`);
  const assertions = JSON.parse(result.stdout);
  assert.ok(Array.isArray(assertions));
  assert.ok(assertions.length > 0);
  assert.ok(assertions.every((a: { passed: boolean }) => a.passed === true));
});
