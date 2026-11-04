# Progress Tracker

Legend: **Dev** = code written Â· **Tested** = automated tests pass Â· **Live** = verified against the real API Â· **Push** = ready to push

| Item | Dev | Tested | Live | Push | Notes |
|---|---|---|---|---|---|
| Plan + scaffold | x | x | n/a | x |  |
| P1 events + pricing | x | x | n/a | x |  |
| P1 tools (read/write/edit/glob/grep/bash, sandbox) | x | x | n/a | x |  |
| P1 agent loop (streaming, usage, cost) | x | x |  | x | Live needs ANTHROPIC_API_KEY; SDK params verified against anthropic 2.4.0 |
| P1 CLI | x |  |  | x | Live needs ANTHROPIC_API_KEY |
| P2 guardrails (allowlist, budgets, denylist, approval) | x | x | n/a | x | landed in P1 |
| P2 MCP | x | x | x | x | mcp 2.x stdio; verified against a real local MCP server in tests |
| P3 lifecycle (intake/supervisor/worker/diagnosis/summarizer) | x | x | | x | Live needs ANTHROPIC_API_KEY |
| P3 git branch + PR | x | x | | x | branch+commit tested on a real temp repo; gh pr create not exercised |
| P4 SQLite store | | | n/a | | |
| P4 FastAPI + SSE | | | | | |
| P5 UI | | | | | |

## Commits ready to push
- `feat: phase 1 core loop` — events, pricing, tools, agent loop, CLI, 10 tests green
- `feat: phase 2 MCP bridge` — mcp.json stdio servers registered as mcp__<server>__<tool>, 11 tests green
- `feat: phase 3 lifecycle` — Run state machine, 5 agents, spawn_worker, structured intake/diagnosis, branch+commit+PR, 14 tests green
