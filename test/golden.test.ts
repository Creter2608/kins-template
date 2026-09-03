import test from "node:test";
import * as assert from "node:assert/strict";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { loadVerifiedGoldenAssertions, parseGoldenAssertions, evaluateGoldenAssertions } from "../src/golden.js";
import { LoopError } from "../src/errors.js";

const GOLDEN_PATH = path.resolve(".eval/golden_assertions.json");
const TRUSTED_SHA = "c9e3edcf9d3c16427221490a55e17de7414cb77b3c6653ffa63073cacf81889c";

test("golden: verifies repository golden assertions against trusted sha", async () => {
  const { digest, document } = await loadVerifiedGoldenAssertions(GOLDEN_PATH, TRUSTED_SHA);
  assert.equal(digest, TRUSTED_SHA);
  assert.equal(document.assertions.length, 5);

  const ids = document.assertions.map((a) => a.id);
  assert.deepEqual(ids, ["ASSERT-01", "ASSERT-02", "ASSERT-03", "ASSERT-04", "ASSERT-05"]);

  const results = evaluateGoldenAssertions(document);
  assert.equal(results.length, 5);
  assert.ok(results.every((r) => r.passed));
});

test("golden: rejects duplicate assertion IDs", () => {
  const malformed = {
    assertions: [
      { id: "DUP", in: "a", out: "b" },
      { id: "DUP", in: "c", out: "d" }
    ]
  };
  assert.throws(
    () => parseGoldenAssertions(malformed),
    (err: unknown) => err instanceof LoopError && err.code === "ASSERTION_SCHEMA_INVALID"
  );
});

test("golden: repository .eval/golden_assertions.json remains unmodified after tests", async () => {
  const currentBytes = await fs.readFile(GOLDEN_PATH);
  const crypto = await import("node:crypto");
  const actualSha = crypto.createHash("sha256").update(currentBytes).digest("hex");
  assert.equal(actualSha, TRUSTED_SHA, "Golden file integrity violation!");
});
