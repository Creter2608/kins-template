import test from "node:test";
import * as assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

const REPO_ROOT = process.cwd();
const ANTI_GAMING_URL = pathToFileURL(path.join(REPO_ROOT, "scripts", "harness", "anti-gaming.mjs")).href;
const { validateGitDiffIntegrity } = (await import(ANTI_GAMING_URL)) as typeof import("../scripts/harness/anti-gaming.d.mts");

function setupTestGitRepo(): { tempDir: string; repoRoot: string; baseCommit: string } {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "template-antigaming-test-"));
  const repoRoot = path.join(tempDir, "repo");
  fs.mkdirSync(repoRoot, { recursive: true });

  execFileSync("git", ["init"], { cwd: repoRoot, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "AntiGaming Tester"], { cwd: repoRoot, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "tester@template.ai"], { cwd: repoRoot, stdio: "ignore" });

  // Create baseline files
  fs.mkdirSync(path.join(repoRoot, "src"), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, "test"), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, ".eval"), { recursive: true });

  fs.writeFileSync(path.join(repoRoot, "src", "math.js"), "export function add(a, b) { return a + b; }\n", "utf-8");
  fs.writeFileSync(
    path.join(repoRoot, "test", "math.test.js"),
    "import assert from 'node:assert';\nimport { add } from '../src/math.js';\nassert.equal(add(1, 2), 3);\n",
    "utf-8"
  );
  fs.writeFileSync(
    path.join(repoRoot, ".eval", "golden.json"),
    JSON.stringify({ assertions: ["ASSERT-01"] }, null, 2),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(repoRoot, "package.json"),
    JSON.stringify({ name: "sample-pkg", version: "1.0.0", scripts: { test: "node --test", build: "tsc" } }, null, 2),
    "utf-8"
  );

  execFileSync("git", ["add", "."], { cwd: repoRoot, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "Baseline commit"], { cwd: repoRoot, stdio: "ignore" });

  const baseCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf-8" }).trim();

  return { tempDir, repoRoot, baseCommit };
}

test("anti-gaming: ordinary clean source change returns clean=true and violations=[]", async () => {
  const { tempDir, repoRoot, baseCommit } = setupTestGitRepo();
  try {
    fs.writeFileSync(path.join(repoRoot, "src", "math.js"), "export function add(a, b) { return (a + b) | 0; }\n", "utf-8");

    const result = await validateGitDiffIntegrity(repoRoot, baseCommit);
    assert.equal(result.clean, true);
    assert.equal(result.violations.length, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("anti-gaming: tracked .eval/ modification returns FORBIDDEN_FILE_MODIFIED", async () => {
  const { tempDir, repoRoot, baseCommit } = setupTestGitRepo();
  try {
    fs.writeFileSync(
      path.join(repoRoot, ".eval", "golden.json"),
      JSON.stringify({ assertions: ["ASSERT-01-tampered"] }, null, 2),
      "utf-8"
    );

    const result = await validateGitDiffIntegrity(repoRoot, baseCommit);
    assert.equal(result.clean, false);
    assert.ok(result.violations.some((v) => v.code === "FORBIDDEN_FILE_MODIFIED" && v.path.includes(".eval")));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("anti-gaming: commented out assertion in test file triggers ASSERTION_COMMENTED_OUT", async () => {
  const { tempDir, repoRoot, baseCommit } = setupTestGitRepo();
  try {
    fs.writeFileSync(
      path.join(repoRoot, "test", "math.test.js"),
      "import assert from 'node:assert';\nimport { add } from '../src/math.js';\n// assert.equal(add(1, 2), 3);\n",
      "utf-8"
    );

    const result = await validateGitDiffIntegrity(repoRoot, baseCommit);
    assert.equal(result.clean, false);
    assert.ok(result.violations.some((v) => v.code === "ASSERTION_COMMENTED_OUT"));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("anti-gaming: removed assertion triggers ASSERTION_REMOVED", async () => {
  const { tempDir, repoRoot, baseCommit } = setupTestGitRepo();
  try {
    fs.writeFileSync(
      path.join(repoRoot, "test", "math.test.js"),
      "import assert from 'node:assert';\nimport { add } from '../src/math.js';\n",
      "utf-8"
    );

    const result = await validateGitDiffIntegrity(repoRoot, baseCommit);
    assert.equal(result.clean, false);
    assert.ok(result.violations.some((v) => v.code === "ASSERTION_REMOVED"));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("anti-gaming: package.json test script tampering triggers FORBIDDEN_FILE_MODIFIED", async () => {
  const { tempDir, repoRoot, baseCommit } = setupTestGitRepo();
  try {
    fs.writeFileSync(
      path.join(repoRoot, "package.json"),
      JSON.stringify({ name: "sample-pkg", version: "1.0.0", scripts: { test: "exit 0", build: "tsc" } }, null, 2),
      "utf-8"
    );

    const result = await validateGitDiffIntegrity(repoRoot, baseCommit);
    assert.equal(result.clean, false);
    assert.ok(result.violations.some((v) => v.code === "FORBIDDEN_FILE_MODIFIED" && v.path === "package.json"));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
