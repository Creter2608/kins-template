# AI-Ready Project Template

A high-performance, deterministic, and security-hardened codebase template designed specifically for autonomous AI coding agents (Antigravity, Claude Code, Cursor, Windsurf).

---

## ⚡ Core Features

- **Standardized Autonomous Loop ([docs/LOOP.md](docs/LOOP.md))**: 6-phase deterministic state machine with strict phase transitions.
- **2-Tier Multi-Agent Pipeline**: Layer 1 GPT Architect (strategic blueprint & assertions) + Layer 2 Gemini 3.8 Flash (native code synthesis & local execution).
- **Anti-Token-Drain Protocol**: Local CPU verification ($0 LLM tokens) with hard cap of 1 retry on test failure.
- **Adversarial Quality Gates**: Built-in integration with `agency-reality-checker` and `agency-ai-generated-code-security-auditor`.
- **Karpathy Behavioral Invariants**: Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution.
- **Living Knowledge Compounding ([wiki/](wiki/))**: Persistent markdown wiki based on Andrej Karpathy's `llm-wiki` architecture.
- **CodeGraph Ready**: Ready for instant AST indexing via `codegraph init`.

---

## 🚀 Getting Started

1. Initialize CodeGraph index (once code files are added):
   ```bash
   codegraph init
   ```

2. Review the Loop specification:
   ```bash
   cat docs/LOOP.md
   ```

3. View autonomous execution history:
   ```bash
   cat wiki/log.md
   ```
