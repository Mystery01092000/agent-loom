"""python -m harness.cli "task" --cwd path  -- single worker agent, prints thinking/text/tools live."""
from __future__ import annotations

import argparse
import sys
import uuid
from pathlib import Path

import anthropic

from .agent import AgentDef, run_agent
from .events import Event, EventBus
from .tools import ToolContext

SYSTEM = (
    "You are a software engineering agent working inside the user's repository. "
    "Use the tools to inspect and change files. Prefer small, correct changes. "
    "Run tests when they exist. When done, summarize what you changed in a few lines."
)


def _print(ev: Event) -> None:
    p = ev.payload
    if ev.type == "thinking":
        print(f"\033[90m{p['delta']}\033[0m", end="", flush=True)
    elif ev.type == "text":
        print(p["delta"], end="", flush=True)
    elif ev.type == "tool_call":
        print(f"\n\033[36m> {p['name']} {p['input']}\033[0m", flush=True)
    elif ev.type == "tool_result":
        head = p["output"].splitlines()[:5]
        print("\033[33m" + "\n".join("  " + h for h in head) + ("\n  ..." if len(p["output"].splitlines()) > 5 else "") + "\033[0m")
    elif ev.type == "usage":
        print(f"\n\033[35m[turn {ev.turn}] in={p['input_tokens']} out={p['output_tokens']} cache_read={p['cache_read_input_tokens']} ${p['cost_usd']:.4f} (total ${p['total_cost_usd']:.4f})\033[0m")
    elif ev.type == "error":
        print(f"\n\033[31m! {p}\033[0m")
    elif ev.type == "agent_end":
        print(f"\n\033[32m== {ev.agent_id} stop={p['stop']} cost=${p['cost_usd']:.4f}\033[0m")


def approve(cmd: str) -> bool:
    return input(f"\nAllow command? [y/N] {cmd}\n> ").strip().lower() == "y"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("task")
    ap.add_argument("--cwd", default=".")
    ap.add_argument("--model", default="claude-opus-5-5")
    ap.add_argument("--effort", default="high")
    a = ap.parse_args(argv)

    bus = EventBus()
    bus.subscribe(_print)
    agent = AgentDef(name="worker", system=SYSTEM, model=a.model, effort=a.effort)
    ctx = ToolContext(root=Path(a.cwd).resolve(), approve=approve)
    res = run_agent(anthropic.Anthropic(), agent, [{"role": "user", "content": a.task}], ctx, bus, run_id=uuid.uuid4().hex[:8])
    return 0 if res.stop == "end_turn" else 1


if __name__ == "__main__":
    sys.exit(main())
