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
| P3 lifecycle (intake/supervisor/worker/diagnosis/summarizer) | x | x | x | x | Live: subtract()+9 tests on a demo repo, diagnosis complete |
| P3 git branch + PR | x | x | partial | x | branch+commit live; gh pr create needs a repo with origin |
| P4 SQLite store | x | x | n/a | x | |
| P4 FastAPI + SSE | x | x | x | x | drove the live run through the API |
| P5 UI | x | x | x | x | Redesigned as a Claude-style chat: user bubble, assistant prose (markdown), collapsible agent steps w/ nested workers + thinking, inline decisions, cost strip at the bottom. Verified live in Chrome on the Go todo-api run |

## How to run
```bash
cd server && uv run uvicorn harness.api:app --port 8765      # needs ANTHROPIC_API_KEY
cd web && npm run dev                                         # http://localhost:5173
cd server && uv run python -m harness.cli "task" --cwd <repo> # terminal flow
```

## Still pending
- API key lives in server/.env (gitignored); loaded automatically.
- `gh pr create` path not exercised (needs a repo with an origin).

## Commits ready to push
- `feat: phase 1 core loop` — events, pricing, tools, agent loop, CLI, 10 tests green
- `feat: phase 2 MCP bridge` — mcp.json stdio servers registered as mcp__<server>__<tool>, 11 tests green
- `feat: phase 3 lifecycle` — Run state machine, 5 agents, spawn_worker, structured intake/diagnosis, branch+commit+PR, 14 tests green
- `feat: phase 4 store + API` — SQLite events/usage, FastAPI runs/decide/events/cost, SSE stream, 16 tests green
- `feat: phase 5 React UI` — runs sidebar, conversation + decision gates, agent trace, cost panel; `npm run build` green
- `fix: exclude build junk from commits` — diagnosis agent caught __pycache__ being committed on repos without .gitignore; 17 tests green
- `feat: chat-style UI` — markdown replies, collapsible steps, inline decisions, cost strip; live-verified on a Go project build ($0.55, 23 calls, go build/vet/test pass)
