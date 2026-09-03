# Technical Specification: Template Tidiness & Clean-Slate Scaffolding

**Document Version:** 1.0.0  
**Target Repository:** `d:\Workspace\template`  
**Author:** Layer 2 Auditor  
**Intended Implementer:** GPT Architect / Coding Agent  
**Standard Adherence:** `AGENTS.md`, `docs/LOOP.md`, Karpathy Invariants (Simplicity First, Surgical Changes)

---

## 1. Context & Objectives

A thorough audit of the template repository revealed that while the AI token-efficiency architecture (FSM loop, thin adapters, token shields, byte-capped runners) is exceptional (9.5/10), the repository suffers from **root directory clutter** and **historical baggage leakage** during project scaffolding.

### Core Goals
1. **Root Directory Pruning**: Eliminate unnecessary root stubs that do not map to IDE entrypoints.
2. **Document Lifecycle & Archival**: Relocate legacy design analysis (28.9 KB) so it does not inflate project contexts.
3. **True Clean-Slate Scaffolding**: Upgrade `scripts/init-template.mjs` to stamp out fresh projects without copying the author's internal development history (`wiki/log.md`).
4. **Deterministic Verification**: Maintain 100% test pass rate (21/21) under `$0` CPU execution in Docker container `kins_autonomous_sandbox`.

---

## 2. Detailed Action Items for GPT

### Task 1: Eliminate Redundant Root `PITFALLS.md`
- **File to Delete:** `PITFALLS.md` (root)
- **Rationale:** 
  - Canonical registry is [`wiki/pitfalls.md`](../wiki/pitfalls.md).
  - Both [`AGENTS.md`](../AGENTS.md) and [`README.md`](../README.md) already link directly to `wiki/pitfalls.md`.
  - No AI tool or IDE requires a root `PITFALLS.md` (unlike `CLAUDE.md`, `.clinerules`, or `.cursor/`).
- **Files to Update (if any references exist):**
  - Check [`README.md`](../README.md) to ensure all pitfall links point strictly to `wiki/pitfalls.md`.

### Task 2: Archive Legacy Research & Plan Documents
- **Source File:** `docs/plans/ai-ready-template-market-comparison.md` (28.9 KB, ~7,000 tokens)
- **Action:**
  - Create directory `docs/archive/`.
  - Move `docs/plans/ai-ready-template-market-comparison.md` -> `docs/archive/ai-ready-template-market-comparison.md`.
  - Ensure `docs/plans/` remains clean for user/project-specific implementation plans.
  - Add `docs/archive/` to `repomix.config.json` ignore list and `.aidigestignore` to prevent token consumption during context aggregation.

### Task 3: Upgrade Scaffolder (`scripts/init-template.mjs`) for Clean-Slate Generation
- **Target File:** `scripts/init-template.mjs`
- **Modifications Required:**
  1. **Exclusion List Enhancement**: Add `'docs/archive'` and `'docs/plans'` to `EXCLUDED_PATTERNS` so that internal template research documents are not stamped out into downstream projects.
  2. **Clean-Slate `wiki/log.md` Generation**:
     - Do not copy the existing 184-line template development log.
     - When initializing the target project, write a fresh `wiki/log.md` containing only the baseline initialization record:
       ```markdown
       # Autonomous Execution Log (wiki/log.md)

       Chronological, append-only record of all autonomous loop runs, ingests, and verification audits.

       ---

       ## [YYYY-MM-DD HH:mm] INIT | Project Scaffolding

       - **Project:** `<project-name>`
       - **Outcome:** `PASSED`
       - **Status:** Initialized from AI-Ready Project Template
       - **Verification:** Fresh Golden Assertions verified (SHA-256)
       ```
  3. **Empty Plans Directory**: Ensure an empty `docs/plans/` directory with a `.gitkeep` is created in the target project.

### Task 4: Update Verification Suite (`test/init-template.test.ts`)
- **Target File:** `test/init-template.test.ts`
- **Assertions to Add:**
  - In test `"init-template: generates clean project with fresh golden assertions and valid sha"`:
    - Assert `fs.existsSync(path.join(target, "docs", "archive")) === false`.
    - Assert `fs.existsSync(path.join(target, "PITFALLS.md")) === false`.
    - Read `path.join(target, "wiki", "log.md")` and assert it does NOT contain `'init-loop-20260903'` or past author run IDs, but contains the new project's name and `'Project Scaffolding'`.

---

## 3. Deterministic Verification Plan

### Test Commands
Run inside Docker container:
```bash
docker exec kins_autonomous_sandbox npm run typecheck
docker exec kins_autonomous_sandbox npm test
```

### Expected Success Criteria
- TypeScript compilation passes with 0 errors (`npm run typecheck`).
- All 21+ unit tests pass cleanly via `node --test` in container.
- Root directory contains 1 fewer redundant file (`PITFALLS.md` removed).
- Any project stamped out via `node scripts/init-template.mjs <dir> --name <name>` is completely clean of author history.

---

## 4. Implementation Guidance for GPT
- Apply Karpathy's **Surgical Changes**: do not rewrite unrelated logic in `init-template.mjs`.
- Respect the **Protected Evaluation Zone** (`.eval/`): do NOT modify `.eval/golden_assertions.json` or its SHA-256 hash.
- Adhere strictly to **Diff-First** verification after applying changes.
