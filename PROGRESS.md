# Progress Tracker

Legend: **Dev** = code written · **Tested** = automated tests pass · **Live** = verified against the real API · **Push** = ready to push

| Item | Dev | Tested | Live | Push | Notes |
|---|---|---|---|---|---|
| Plan + scaffold | x | x | n/a | x |  |
| P1 events + pricing | x | x | n/a | x |  |
| P1 tools (read/write/edit/glob/grep/bash, sandbox) | x | x | n/a | x |  |
| P1 agent loop (streaming, usage, cost) | x | x |  | x | Live needs ANTHROPIC_API_KEY; SDK params verified against anthropic 2.4.0 |
| P1 CLI | x |  |  | x | Live needs ANTHROPIC_API_KEY |
| P2 guardrails (allowlist, budgets, denylist, approval) | | | n/a | | |
| P2 MCP | | | | | |
| P3 lifecycle (intake/supervisor/worker/diagnosis/summarizer) | | | | | |
| P3 git branch + PR | | | | | |
| P4 SQLite store | | | n/a | | |
| P4 FastAPI + SSE | | | | | |
| P5 UI | | | | | |

## Commits ready to push
- `feat: phase 1 core loop` � events, pricing, tools, agent loop, CLI, 10 tests green
