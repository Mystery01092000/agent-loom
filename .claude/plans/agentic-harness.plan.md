# Plan: Agentic Harness

**Source**: conversational (/ecc:plan, 2026-11-04)
**Complexity**: Large
**Stack**: Python 3.13 backend (FastAPI, `anthropic` SDK, `mcp`, SQLite), React + Vite UI

## Summary
A local agent harness in the spirit of Claude Code / Cowork with a web UI. Lifecycle:
Intake → user confirms summary → Supervisor loop spawns Worker subagents and reviews them →
Diagnosis checks result against the original request → Summarizer commits to a branch and offers a PR.
Every agent has tool allowlists, a filesystem sandbox, command approval, and turn/token budgets.
All agent thinking, tool calls, token usage and cost are recorded and streamed to the UI.

## Patterns to Mirror
Repo was empty at plan time. No existing patterns. Conventions set here:
- Package `server/harness/`, one module per concern, stdlib first, pytest tests in `server/tests/`.
- Errors from tools are returned to the model as `tool_result` with `is_error: true`, never raised.
- Every API call emits one `usage` event with tokens and cost.

## Layout
```
server/            uv project (pyproject.toml)
  harness/
    agent.py       AgentDef + run_agent (manual streaming loop, append-only history)
    tools.py       built-in tools + sandbox + bash denylist/approval
    mcp_tools.py   MCP client → tool registry           (Phase 2)
    lifecycle.py   Run state machine, 5 agents         (Phase 3)
    store.py       SQLite event/usage store            (Phase 4)
    api.py         FastAPI + SSE                       (Phase 4)
    pricing.py     price table + cost()
    events.py      Event + EventBus
    cli.py         `python -m harness.cli "task"`
  tests/
web/               React + Vite + Tailwind             (Phase 5)
PROGRESS.md        developed / tested / ready-to-push tracker
```

## Models and API settings
- Supervisor, Intake, Diagnosis, Summarizer: `claude-opus-5-5`, effort `high`.
- Workers: `claude-sonnet-5-5` by default (configurable), effort `medium`.
- `thinking: {type: adaptive, display: summarized}` so thinking is visible in the UI.
- Streaming always; `fallbacks: "default"` with beta `server-side-fallback-2026-07-01`.
- Append full `response.content` back to history (append-only; required for preserved thinking).
- `strict: true` on every custom tool; prompt caching on the system prompt.

## Tasks

### Phase 1: Core loop (CLI)
- `events.py`, `pricing.py`, `tools.py` (read/write/edit/glob/grep/bash, sandboxed to cwd), `agent.py`, `cli.py`.
- Validate: `pytest` with a fake client; live: `python -m harness.cli "add hello()" --cwd <tmp repo>`.

### Phase 2: Guardrails + MCP
- `AgentDef.tools` allowlist, `max_turns`, `max_tokens_total`, `max_cost_usd`.
- Bash denylist + approval callback (pauses run). Path escape rejection.
- `mcp.json` → stdio MCP servers → tools named `mcp__<server>__<tool>`.
- Validate: tests for escape, denylist, budget stop, MCP round-trip with a sample server.

### Phase 3: Lifecycle
- States: intake → awaiting_confirmation → working → diagnosing → summarizing → awaiting_pr_decision → done.
- Intake uses structured output `{understanding, plan, questions}`.
- Supervisor tools: `spawn_worker(task, files)`, `review(worker_id, verdict)`.
- Diagnosis gets original request + intake summary + `git diff` + test output → `{complete, gaps}`.
- Summarizer: branch `harness/<slug>`, commit, ask about PR, `gh pr create`.
- Validate: e2e on a sample repo yields a branch and a PR.

### Phase 4: Observability
- SQLite `events` table (run_id, agent_id, parent_agent_id, turn, type, payload, ts) + usage rollups.
- FastAPI: `POST /runs`, `GET /runs`, `GET /runs/{id}/events` (SSE live + replay), `GET /runs/{id}/cost`, `POST /runs/{id}/confirm|approve`.

### Phase 5: UI
- Panes: conversation, agent tree with expandable thinking/tool calls, cost ticker.
- Approval modal, intake confirmation, run history + replay.
- Types generated from FastAPI OpenAPI via `openapi-typescript`.

## Validation
```bash
cd server && uv run pytest -q
cd server && uv run python -m harness.cli "task" --cwd ../sample
cd web && npm run build
```

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| Cost blowup from nested agents | High | Per-run $ cap, Sonnet workers, caching, live cost ticker |
| Shell tool damaging host | High | cwd sandbox, denylist, approval gate, fresh branch per run |
| Context growth on long runs | Medium | Fresh context per worker; add compaction beta if needed |
| Diagnosis rubber-stamps | Medium | Feed it diff + test output, not worker self-reports |
| Windows shell quirks | Medium | PowerShell default, Git Bash optional, tests run on Windows |

## Acceptance
- [ ] All phases complete
- [ ] `pytest` green, `npm run build` green
- [ ] Live e2e run produces a branch + PR with full trace and cost in the UI
