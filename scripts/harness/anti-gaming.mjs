#!/usr/bin/env node
/**
 * scripts/harness/anti-gaming.mjs
 * Zero-dependency Anti-Gaming & Tampering Detection Engine for autonomous agents.
 * Scans git diff between trusted baseCommit and current workspace to detect assertion relaxation,
 * mock evasion, and unauthorized modifications to protected evaluation configurations.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const FORBIDDEN_PATH_PATTERNS = [
  /^\.eval(?:\/|$)/i,
  /^\.ai\/secure-patches(?:\/|$)/i,
  /^\.github(?:\/|$)/i,
  /(?:^|\/)(?:jest|vitest|playwright|cypress|mocha|test)\.config\.[a-z0-9]+$/i,
  /(?:^|\/)\.mocharc(?:\.[a-z0-9]+)?$/i,
  /(?:^|\/)tsconfig\.test\.json$/i
];

const TEST_SCRIPT_KEY_REGEX = /^(?:pretest|test|posttest)(?::|$)/;
const TEST_FILE_PATH_REGEX = /(?:^|\/)(?:test|tests|__tests__)\/|\.(?:test|spec)\.[a-z0-9]+$/i;
const HARNESS_OR_VERIFIER_PATH_REGEX = /(?:verif|validat|eval|integrity|harness)/i;

const ASSERTION_CALL_REGEX = /\b(?:assert(?:\.[a-zA-Z0-9_$]+|\()|expect\(|assertThat\()/;
const COMMENTED_ASSERTION_REGEX = /^\+\s*(?:\/\/|\/\*|\*)\s*(?:await\s+)?(?:assert(?:\.[a-zA-Z0-9_$]+|\()|expect\(|assertThat\()/;
const REMOVED_ASSERTION_REGEX = /^-\s*(?:await\s+)?(?:assert(?:\.[a-zA-Z0-9_$]+|\()|expect\(|assertThat\()/;
const MOCK_EVASION_REGEX = /\breturn\s+(?:true|{\s*(?:clean|success|passed)\s*:\s*true\s*})\s*;?/;

export async function validateGitDiffIntegrity(repoRoot, baseCommit, options = {}) {
  if (!repoRoot || !fs.existsSync(repoRoot)) {
    throw new Error(`Invalid repoRoot: ${repoRoot}`);
  }
  if (!baseCommit || typeof baseCommit !== 'string') {
    throw new Error(`Invalid baseCommit: ${baseCommit}`);
  }

  // 1. Resolve base commit to full SHA
  let resolvedBase;
  try {
    resolvedBase = execFileSync(
      'git',
      ['-c', 'safe.directory=*', 'rev-parse', '--verify', '--end-of-options', `${baseCommit}^{commit}`],
      { cwd: repoRoot, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    ).trim();
  } catch (err) {
    throw new Error(`Failed to resolve base commit '${baseCommit}': ${err.message}`);
  }

  const violations = [];

  // 2. Obtain NUL-delimited changed file paths (status + path)
  let nameStatusRaw;
  try {
    nameStatusRaw = execFileSync(
      'git',
      ['-c', 'safe.directory=*', 'diff', '--name-status', '-z', '--no-ext-diff', '--no-color', resolvedBase, '--'],
      { cwd: repoRoot, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }
    );
  } catch (err) {
    throw new Error(`Git diff execution failed: ${err.message}`);
  }

  const changedPaths = parseNameStatusZ(nameStatusRaw);

  // 2.5 Query untracked, non-ignored files to prevent evasion via untracked additions
  let untrackedRaw = '';
  try {
    untrackedRaw = execFileSync(
      'git',
      ['-c', 'safe.directory=*', 'ls-files', '--others', '--exclude-standard', '-z'],
      { cwd: repoRoot, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }
    );
  } catch (err) {
    throw new Error(`Git ls-files untracked query failed: ${err.message}`);
  }

  const untrackedPaths = untrackedRaw ? untrackedRaw.split('\0').filter(Boolean) : [];
  const candidatePaths = Array.from(new Set([...changedPaths, ...untrackedPaths])).sort();

  // 3. Path-level inspection (FORBIDDEN_FILE_MODIFIED)
  for (const filePath of candidatePaths) {
    const normalized = filePath.replace(/\\/g, '/');

    // Check forbidden directories and test configs
    if (isForbiddenPath(normalized)) {
      violations.push({
        code: 'FORBIDDEN_FILE_MODIFIED',
        path: normalized,
        message: `Modification to protected path '${normalized}' is strictly forbidden.`
      });
      continue;
    }

    // Check package.json test script modifications
    if (normalized === 'package.json') {
      const packageViolation = checkPackageJsonTestScripts(repoRoot, resolvedBase);
      if (packageViolation) {
        violations.push(packageViolation);
      }
    }
  }

  // 4. Content-level inspection via unified diff
  let diffRaw;
  try {
    diffRaw = execFileSync(
      'git',
      ['-c', 'safe.directory=*', 'diff', '-U0', '--no-ext-diff', '--no-color', resolvedBase, '--'],
      { cwd: repoRoot, encoding: 'utf-8', maxBuffer: 20 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }
    );
  } catch (err) {
    throw new Error(`Git unified diff execution failed: ${err.message}`);
  }

  const diffHunksByFile = parseUnifiedDiff(diffRaw);

  for (const { filePath, hunks } of diffHunksByFile) {
    const isTestFile = TEST_FILE_PATH_REGEX.test(filePath);
    const isVerifierFile = !isTestFile && HARNESS_OR_VERIFIER_PATH_REGEX.test(filePath);

    for (const hunk of hunks) {
      let currentNewLine = hunk.newStart;

      for (const line of hunk.lines) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          // ASSERTION_COMMENTED_OUT in test files
          if (isTestFile && COMMENTED_ASSERTION_REGEX.test(line)) {
            violations.push({
              code: 'ASSERTION_COMMENTED_OUT',
              path: filePath,
              line: currentNewLine,
              message: `Assertion commented out in test file: ${line.trim()}`
            });
          }

          // MOCK_EVASION in verifier / harness code
          if (isVerifierFile && MOCK_EVASION_REGEX.test(line)) {
            violations.push({
              code: 'MOCK_EVASION',
              path: filePath,
              line: currentNewLine,
              message: `Suspicious verification short-circuit / mock evasion detected: ${line.trim()}`
            });
          }

          currentNewLine++;
        }
      }

      // ASSERTION_REMOVED in test files: only flag if assertions are net-removed without replacement
      if (isTestFile) {
        const addedAssertionCount = hunk.lines.filter(
          (l) => l.startsWith('+') && !l.startsWith('+++') && ASSERTION_CALL_REGEX.test(l) && !COMMENTED_ASSERTION_REGEX.test(l)
        ).length;
        const removedAssertionLines = hunk.lines.filter(
          (l) => l.startsWith('-') && !l.startsWith('---') && REMOVED_ASSERTION_REGEX.test(l)
        );

        if (removedAssertionLines.length > addedAssertionCount) {
          for (const line of removedAssertionLines.slice(addedAssertionCount)) {
            violations.push({
              code: 'ASSERTION_REMOVED',
              path: filePath,
              line: hunk.oldStart,
              message: `Active assertion removed without replacement: ${line.trim()}`
            });
          }
        }
      }
    }

    // 5. ASSERTION_SWALLOWED check (empty catch wrapping assertions)
    if (isTestFile) {
      const swallowedViolations = checkSwallowedAssertions(repoRoot, filePath, hunks);
      violations.push(...swallowedViolations);
    }
  }

  // Deduplicate and sort deterministically: path -> line -> code
  const uniqueViolations = deduplicateViolations(violations);
  uniqueViolations.sort((a, b) => {
    const pCmp = a.path.localeCompare(b.path);
    if (pCmp !== 0) return pCmp;
    const lineA = a.line ?? Number.MAX_SAFE_INTEGER;
    const lineB = b.line ?? Number.MAX_SAFE_INTEGER;
    if (lineA !== lineB) return lineA - lineB;
    return a.code.localeCompare(b.code);
  });

  return {
    clean: uniqueViolations.length === 0,
    violations: uniqueViolations
  };
}

function isForbiddenPath(filePath) {
  const norm = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  return FORBIDDEN_PATH_PATTERNS.some((pattern) => pattern.test(norm));
}

function parseNameStatusZ(raw) {
  if (!raw) return [];
  const entries = raw.split('\0').filter(Boolean);
  const paths = new Set();

  for (let i = 0; i < entries.length; i++) {
    const status = entries[i];
    if (!status) continue;
    const statusChar = status[0];

    if (statusChar === 'R' || statusChar === 'C') {
      const oldPath = entries[++i];
      const newPath = entries[++i];
      if (oldPath) paths.add(oldPath);
      if (newPath) paths.add(newPath);
    } else {
      const p = entries[++i];
      if (p) paths.add(p);
    }
  }

  return Array.from(paths);
}

function parseUnifiedDiff(rawDiff) {
  if (!rawDiff) return [];
  const files = [];
  const lines = rawDiff.split('\n');

  let currentFile = null;
  let currentHunk = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('diff --git ')) {
      currentFile = null;
      currentHunk = null;
    } else if (line.startsWith('+++ b/')) {
      const targetPath = line.slice(6).trim().replace(/\\/g, '/');
      currentFile = { filePath: targetPath, hunks: [] };
      files.push(currentFile);
    } else if (line.startsWith('@@ ') && currentFile) {
      const match = /^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/.exec(line);
      if (match) {
        currentHunk = {
          oldStart: parseInt(match[1], 10),
          newStart: parseInt(match[2], 10),
          lines: []
        };
        currentFile.hunks.push(currentHunk);
      }
    } else if (currentHunk && (line.startsWith('+') || line.startsWith('-'))) {
      currentHunk.lines.push(line);
    }
  }

  return files;
}

function checkPackageJsonTestScripts(repoRoot, baseSha) {
  let baseScripts = {};
  let currentScripts = {};

  try {
    const baseContent = execFileSync(
      'git',
      ['-c', 'safe.directory=*', 'show', `${baseSha}:package.json`],
      { cwd: repoRoot, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    const parsed = JSON.parse(baseContent);
    baseScripts = parsed && typeof parsed.scripts === 'object' ? parsed.scripts : {};
  } catch {
    baseScripts = {};
  }

  const currentPkgPath = path.join(repoRoot, 'package.json');
  if (fs.existsSync(currentPkgPath)) {
    try {
      const currentContent = fs.readFileSync(currentPkgPath, 'utf-8');
      const parsed = JSON.parse(currentContent);
      currentScripts = parsed && typeof parsed.scripts === 'object' ? parsed.scripts : {};
    } catch (err) {
      return {
        code: 'FORBIDDEN_FILE_MODIFIED',
        path: 'package.json',
        message: `package.json is malformed JSON: ${err.message}`
      };
    }
  }

  const allKeys = new Set([...Object.keys(baseScripts), ...Object.keys(currentScripts)]);
  for (const key of allKeys) {
    if (TEST_SCRIPT_KEY_REGEX.test(key)) {
      const baseVal = baseScripts[key];
      const curVal = currentScripts[key];
      if (baseVal !== curVal) {
        return {
          code: 'FORBIDDEN_FILE_MODIFIED',
          path: 'package.json',
          message: `Forbidden alteration of test script '${key}': '${baseVal ?? '<absent>'}' -> '${curVal ?? '<absent>'}'`
        };
      }
    }
  }

  return null;
}

function checkSwallowedAssertions(repoRoot, filePath, hunks) {
  const fullPath = path.join(repoRoot, filePath);
  if (!fs.existsSync(fullPath)) return [];

  let content;
  try {
    content = fs.readFileSync(fullPath, 'utf-8');
  } catch {
    return [];
  }

  const emptyCatchRegex = /try\s*\{([\s\S]*?)\}\s*catch(?:\s*\([^)]*\))?\s*\{\s*\}/g;
  const violations = [];
  let match;

  while ((match = emptyCatchRegex.exec(content)) !== null) {
    const tryBody = match[1];
    if (ASSERTION_CALL_REGEX.test(tryBody)) {
      const upToMatch = content.slice(0, match.index);
      const lineNumber = upToMatch.split('\n').length;

      const overlapsHunk = hunks.some((h) => {
        const addedCount = h.lines.filter((l) => l.startsWith('+') && !l.startsWith('+++')).length;
        const hunkEnd = h.newStart + Math.max(1, addedCount);
        return lineNumber >= h.newStart - 2 && lineNumber <= hunkEnd + 2;
      });

      if (overlapsHunk) {
        violations.push({
          code: 'ASSERTION_SWALLOWED',
          path: filePath,
          line: lineNumber,
          message: `Assertion swallowed inside empty catch block at line ${lineNumber}`
        });
      }
    }
  }

  return violations;
}

function deduplicateViolations(violations) {
  const seen = new Set();
  const res = [];
  for (const v of violations) {
    const key = `${v.code}:${v.path}:${v.line ?? 'null'}`;
    if (!seen.has(key)) {
      seen.add(key);
      res.push(v);
    }
  }
  return res;
}

async function main() {
  const args = process.argv.slice(2);
  let baseCommit = '';
  let repoRoot = REPO_ROOT;
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--base' || arg === '-b') {
      baseCommit = args[++i] || '';
    } else if (arg === '--repo' || arg === '-r') {
      repoRoot = path.resolve(args[++i] || REPO_ROOT);
    } else if (arg === '--json') {
      jsonOutput = true;
    } else if (arg === '--help' || arg === '-h') {
      process.stdout.write(`
Usage: node scripts/harness/anti-gaming.mjs [options]

Options:
  --base, -b <commit>   Trusted base commit to compare against (default: merge-base or HEAD)
  --repo, -r <path>     Path to git repository root (default: cwd)
  --json                Output results as JSON
  --help, -h            Show this help message
`.trim() + '\n');
      process.exit(0);
    }
  }

  if (!baseCommit) {
    try {
      baseCommit = execFileSync('git', ['-c', 'safe.directory=*', 'merge-base', 'HEAD', 'main'], {
        cwd: repoRoot,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe']
      }).trim();
    } catch {
      baseCommit = 'HEAD';
    }
  }

  try {
    const result = await validateGitDiffIntegrity(repoRoot, baseCommit);
    if (jsonOutput) {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    } else {
      if (result.clean) {
        process.stdout.write(`[anti-gaming] PASS (0 violations against base ${baseCommit})\n`);
        process.exit(0);
      } else {
        process.stderr.write(`[anti-gaming] FAILED: SPECIFICATION_INTEGRITY (${result.violations.length} violation(s)):\n`);
        for (const v of result.violations) {
          process.stderr.write(`  - [${v.code}] ${v.path}${v.line ? `:${v.line}` : ''}: ${v.message}\n`);
        }
        process.exit(1);
      }
    }
  } catch (err) {
    process.stderr.write(`[anti-gaming ERROR] ${err.message}\n`);
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    process.stderr.write(`[anti-gaming ERROR] ${err.message}\n`);
    process.exit(1);
  });
}
