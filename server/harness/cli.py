"""python -m harness.cli "task" --cwd path   full lifecycle (intake -> supervisor -> diagnosis -> summary -> PR)
   python -m harness.cli "task" --worker     single worker agent only."""
from __future__ import annotations

import argparse
import json
import sys
import uuid
from pathlib import Path
from typing import Any

import anthropic

from .agent import AgentDef, run_agent
from .config import load_config
from .events import Event, EventBus
from .lifecycle import Run
from .tools import ToolContext


def _print(ev: Event) -> None:
    p = ev.payload
    if ev.type == "thinking":
        print(f"\033[90m{p['delta']}\033[0m", end="", flush=True)
    elif ev.type == "text":
        print(p["delta"], end="", flush=True)
    elif ev.type == "agent_start":
        print(f"\n\033[1m## {ev.agent_id} ({p['model']}, effort={p['effort']})\033[0m")
    elif ev.type == "tool_call":
        print(f"\n\033[36m> {p['name']} {json.dumps(p['input'])[:300]}\033[0m", flush=True)
    elif ev.type == "tool_result":
        lines = p["output"].splitlines()
        print("\033[33m" + "\n".join("  " + h for h in lines[:5]) + ("\n  ..." if len(lines) > 5 else "") + "\033[0m")
    elif ev.type == "usage":
        print(f"\n\033[35m[turn {ev.turn}] in={p['input_tokens']} out={p['output_tokens']} cache_read={p['cache_read_input_tokens']} ${p['cost_usd']:.4f} (agent ${p['total_cost_usd']:.4f})\033[0m")
    elif ev.type == "error":
        print(f"\n\033[31m! {p}\033[0m")
    elif ev.type == "agent_end":
        print(f"\n\033[32m== {ev.agent_id} stop={p['stop']} cost=${p['cost_usd']:.4f}\033[0m")
    elif ev.type == "state":
        print(f"\n\033[1;34m[{p['state']}]\033[0m")
    elif ev.type in ("branch", "pr", "diagnosis"):
        print(f"\n\033[1;34m{ev.type}: {json.dumps(p)}\033[0m")


class TerminalIO:
    def confirm_intake(self, intake: dict[str, Any]) -> tuple[bool, str]:
        print("\n\033[1mUnderstanding:\033[0m", intake["understanding"])
        print("\033[1mPlan:\033[0m\n" + "\n".join(f"  {i + 1}. {s}" for i, s in enumerate(intake["plan"])))
        if intake["questions"]:
            print("\033[1mQuestions:\033[0m\n" + "\n".join(f"  - {q}" for q in intake["questions"]))
        ans = input("\nProceed? [y / or type feedback] > ").strip()
        return (True, "") if ans.lower() in ("y", "yes") else (False, ans or "please reconsider")

    def approve_command(self, command: str) -> bool:
        return input(f"\nAllow command? [y/N] {command}\n> ").strip().lower() == "y"

    def want_pr(self, summary: str) -> bool:
        print("\n" + summary)
        return input("\nOpen a PR? [y/N] > ").strip().lower() == "y"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("task")
    ap.add_argument("--cwd", default=".")
    ap.add_argument("--model", default="claude-opus-5-5", help="model for intake/supervisor/diagnosis/summary")
    ap.add_argument("--worker-model", default="claude-sonnet-5-5")
    ap.add_argument("--max-cost", type=float, default=20.0)
    ap.add_argument("--worker", action="store_true", help="run a single worker agent instead of the lifecycle")
    a = ap.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # Windows consoles default to cp1252 and choke on model output

    bus = EventBus()
    bus.subscribe(_print)
    cwd = Path(a.cwd).resolve()
    io = TerminalIO()
    client = anthropic.Anthropic()

    if a.worker:
        cfg = load_config(cwd)
        agent = AgentDef(name="worker", system=cfg.system_prompt("worker"), model=a.model, max_cost_usd=a.max_cost)
        res = run_agent(client, agent, [{"role": "user", "content": a.task}], ToolContext(root=cwd, approve=io.approve_command), bus, run_id=uuid.uuid4().hex[:8])
        return 0 if res.stop == "end_turn" else 1

    run = Run(task=a.task, cwd=cwd, io=io, client=client, bus=bus, main_model=a.model, worker_model=a.worker_model, max_cost_usd=a.max_cost)
    run.run()
    print(f"\nTotal cost: ${run.cost_usd:.4f}  branch={run.branch} commit={run.commit} pr={run.pr_url or '-'}")
    return 0 if run.state == "done" else 1


if __name__ == "__main__":
    sys.exit(main())
