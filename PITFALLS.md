# Living Pitfalls & Anti-Patterns Registry

Canonical registry: **[wiki/pitfalls.md](wiki/pitfalls.md)**

This repository maintains a living registry of failure modes, cognitive traps, and real-world stumbling blocks per Andrej Karpathy's LLM-Wiki standard.

## Core Invariants
1. **PITFALL-001**: Always anchor root path via `process.cwd()` in tests to avoid `dist/` vs `src/` tree depth drift.
2. **PITFALL-002**: Always parse SHA-256 digests with `.trim().split(/\s+/)[0]` to handle POSIX `sha256sum` output.
3. **PITFALL-003**: 100% shell execution through `docker exec kins_autonomous_sandbox <cmd>`.
4. **PITFALL-004**: Protected `.eval/` zone is strictly read-only; tampering is forbidden.
5. **PITFALL-005**: Bound terminal outputs to 32 KiB using `scripts/ai-exec.mjs`.
6. **PITFALL-006**: Persist loop state using `scripts/ai-loop.mjs` with atomic file locking.
7. **PITFALL-007**: Hard cap = 1 targeted retry with root-cause hypothesis.
8. **PITFALL-008**: Enforce `.gitattributes` (`eol=lf`) and canonical LF SHA-256 anchors to prevent cross-platform hash divergence.

👉 See full diagnostic breakdowns and recovery guidelines in **[wiki/pitfalls.md](wiki/pitfalls.md)**.
