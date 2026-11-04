"""Run lifecycle: intake -> confirm -> supervisor(workers) -> diagnosis -> summarizer -> branch/PR.

User decisions go through UserIO so the CLI (input()) and the API (queues) share this code.
"""
from __future__ import annotations

import json
import threading
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol

from . import git
from .agent import AgentDef, RunResult, run_agent
from .events import Event, EventBus
from .tools import ALL_TOOLS, ToolContext

READ_ONLY = ["read_file", "glob", "grep"]

INTAKE_SCHEMA = {
    "type": "object",
    "properties": {
        "understanding": {"type": "string", "description": "What the user wants, in 2-4 sentences"},
        "plan": {"type": "array", "items": {"type": "string"}, "description": "Concrete steps you think are needed"},
        "questions": {"type": "array", "items": {"type": "string"}, "description": "Open questions; empty if none"},
    },
    "required": ["understanding", "plan", "questions"],
    "additionalProperties": False,
}
DIAG_SCHEMA = {
    "type": "object",
    "properties": {
        "complete": {"type": "boolean"},
        "gaps": {"type": "array", "items": {"type": "string"}, "description": "What is missing or wrong vs the request"},
        "evidence": {"type": "string", "description": "What you checked (files, tests run, outputs)"},
    },
    "required": ["complete", "gaps", "evidence"],
    "additionalProperties": False,
}

INTAKE_SYS = (
    "You are the intake agent. Read the user's request and skim the repository with the read-only tools "
    "to understand context. Produce a short, concrete understanding and plan. Ask questions only when the "
    "request is genuinely ambiguous in a way that changes the work. Do not write any code."
)
SUPERVISOR_SYS = (
    "You are the supervisor. You own delivering the confirmed plan. Split the work into independent tasks and "
    "delegate each with spawn_worker, giving the worker the full context it needs (files, conventions, acceptance "
    "criteria). Workers have their own fresh context and do not see this conversation. After each worker returns, "
    "verify its work yourself by reading the files or running commands; re-spawn with precise corrections if needed. "
    "Do not edit files yourself. Finish with a short report of what was done."
)
WORKER_SYS = (
    "You are a software engineering worker. Complete exactly the task given, inside this repository. Read before "
    "you edit, keep changes minimal and correct, run tests when they exist. Finish with a few lines stating what "
    "you changed and anything you could not do."
)
DIAG_SYS = (
    "You are the diagnosis agent. Decide whether the work in the diff fully satisfies the user's original request. "
    "Verify independently: read the changed files, run the tests or the code if practical. Be strict and specific; "
    "list every gap. Do not edit files."
)
SUMMARY_SYS = (
    "You are the summarizer. Write a concise markdown summary for the user of what was changed and why, with the "
    "diagnosis verdict. Then a one-line PR title on the last line prefixed with 'TITLE: '. Do not use tools."
)


class UserIO(Protocol):
    def confirm_intake(self, intake: dict[str, Any]) -> tuple[bool, str]: ...  # (approved, feedback)
    def approve_command(self, command: str) -> bool: ...
    def want_pr(self, summary: str) -> bool: ...


@dataclass
class Run:
    task: str
    cwd: Path
    io: UserIO
    client: Any
    bus: EventBus = field(default_factory=EventBus)
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    worker_model: str = "claude-sonnet-5-5"
    main_model: str = "claude-opus-5-5"
    max_cost_usd: float = 20.0
    state: str = "created"
    intake: dict[str, Any] | None = None
    diagnosis: dict[str, Any] | None = None
    summary: str = ""
    branch: str = ""
    commit: str = ""
    pr_url: str = ""
    cost_usd: float = 0.0
    cancelled: threading.Event = field(default_factory=threading.Event)
    _workers: int = 0

    def __post_init__(self) -> None:
        self.bus.subscribe(self._track_cost)

    def cancel(self) -> None:
        self.cancelled.set()

    def _check_cancel(self) -> None:
        if self.cancelled.is_set():
            raise RuntimeError("cancelled by user")

    def _track_cost(self, ev: Event) -> None:
        if ev.type == "usage":
            self.cost_usd += ev.payload["cost_usd"]

    def _set(self, state: str, **payload: Any) -> None:
        self.state = state
        self.bus.emit(Event("state", self.id, "run", {"state": state, **payload}))

    def _ctx(self) -> ToolContext:
        return ToolContext(root=self.cwd, approve=self.io.approve_command)

    def _agent(self, name: str, system: str, **kw: Any) -> AgentDef:
        return AgentDef(name=name, system=system, model=self.main_model, effort="high", max_cost_usd=self.max_cost_usd, **kw)

    def _run(self, agent: AgentDef, prompt: str, parent: str | None = None) -> RunResult:
        self._check_cancel()
        if self.cost_usd > self.max_cost_usd:
            raise RuntimeError(f"run cost ${self.cost_usd:.2f} exceeds cap ${self.max_cost_usd:.2f}")
        res = run_agent(self.client, agent, [{"role": "user", "content": prompt}], self._ctx(), self.bus, run_id=self.id, parent_id=parent, cancel=self.cancelled)
        self._check_cancel()
        return res

    # --- phases -------------------------------------------------------------

    def run_intake(self) -> dict[str, Any]:
        self._set("intake")
        agent = self._agent("intake", INTAKE_SYS, tools=READ_ONLY, output_schema=INTAKE_SCHEMA, max_turns=15)
        prompt = f"User request:\n{self.task}"
        for _ in range(3):
            res = self._run(agent, prompt)
            self.intake = json.loads(res.text)
            self._set("awaiting_confirmation", intake=self.intake)
            ok, feedback = self.io.confirm_intake(self.intake)
            if ok:
                return self.intake
            prompt = f"User request:\n{self.task}\n\nYour previous understanding:\n{json.dumps(self.intake, indent=2)}\n\nUser feedback:\n{feedback}"
        raise RuntimeError("intake not confirmed after 3 attempts")

    def _spawn_worker_tool(self) -> dict[str, Any]:
        schema = {
            "description": "Run a worker agent with fresh context on one well-specified task. Returns the worker's final report.",
            "strict": True,
            "input_schema": {
                "type": "object",
                "properties": {
                    "task": {"type": "string", "description": "Exactly what to do, with acceptance criteria"},
                    "context": {"type": "string", "description": "Relevant files, conventions, and constraints the worker must know"},
                },
                "required": ["task", "context"],
                "additionalProperties": False,
            },
        }

        def spawn(ctx: ToolContext, task: str, context: str) -> str:
            self._workers += 1
            worker = AgentDef(name=f"worker{self._workers}", system=WORKER_SYS, model=self.worker_model, effort="medium", max_cost_usd=self.max_cost_usd)
            res = self._run(worker, f"Task:\n{task}\n\nContext:\n{context}", parent=self._supervisor_id)
            return f"[worker stop={res.stop} cost=${res.cost_usd:.3f}]\n{res.text}"

        return {"spawn_worker": (schema, spawn)}

    def run_supervisor(self, extra: str = "") -> str:
        self._set("working")
        self._supervisor_id = f"supervisor-{uuid.uuid4().hex[:6]}"
        agent = self._agent("supervisor", SUPERVISOR_SYS, tools=READ_ONLY + ["bash", "spawn_worker"], extra_tools=self._spawn_worker_tool())
        prompt = f"User request:\n{self.task}\n\nConfirmed understanding and plan:\n{json.dumps(self.intake, indent=2)}"
        if extra:
            prompt += f"\n\n{extra}"
        self._check_cancel()
        res = run_agent(self.client, agent, [{"role": "user", "content": prompt}], self._ctx(), self.bus, run_id=self.id, agent_id=self._supervisor_id, cancel=self.cancelled)
        self._check_cancel()
        return res.text

    def run_diagnosis(self) -> dict[str, Any]:
        self._set("diagnosing")
        agent = self._agent("diagnosis", DIAG_SYS, tools=READ_ONLY + ["bash"], output_schema=DIAG_SCHEMA, max_turns=20)
        prompt = (
            f"User request:\n{self.task}\n\nConfirmed plan:\n{json.dumps(self.intake, indent=2)}\n\n"
            f"Diff of the work:\n```\n{git.diff(self.cwd) if git.is_repo(self.cwd) else '(not a git repo)'}\n```"
        )
        self.diagnosis = json.loads(self._run(agent, prompt).text)
        self.bus.emit(Event("diagnosis", self.id, "run", self.diagnosis))
        return self.diagnosis

    def run_summary(self) -> str:
        self._set("summarizing")
        agent = self._agent("summarizer", SUMMARY_SYS, tools=[], max_turns=1)
        prompt = (
            f"User request:\n{self.task}\n\nDiagnosis:\n{json.dumps(self.diagnosis, indent=2)}\n\n"
            f"Changes:\n{git.diff_stat(self.cwd) if git.is_repo(self.cwd) else '(not a git repo)'}\n\nBranch: {self.branch or '(none)'}"
        )
        self.summary = self._run(agent, prompt).text
        return self.summary

    def run(self) -> "Run":
        try:
            self.run_intake()
            if git.is_repo(self.cwd):
                self.branch = git.create_branch(self.cwd, git.slugify(self.task))
                self.bus.emit(Event("branch", self.id, "run", {"branch": self.branch}))
            self.run_supervisor()
            for attempt in range(2):
                diag = self.run_diagnosis()
                if diag["complete"] or attempt == 1:
                    break
                self.run_supervisor("Diagnosis found gaps that must be fixed:\n- " + "\n- ".join(diag["gaps"]))
            if self.branch:
                self.commit = git.commit_all(self.cwd, f"harness: {self.task[:60]}")
            self.run_summary()
            self._set("awaiting_pr_decision", summary=self.summary)
            if self.branch and self.commit and self.io.want_pr(self.summary):
                title = next((l[7:].strip() for l in reversed(self.summary.splitlines()) if l.startswith("TITLE:")), self.task[:60])
                self.pr_url = git.create_pr(self.cwd, title, self.summary)
                self.bus.emit(Event("pr", self.id, "run", {"url": self.pr_url}))
            self._set("done", cost_usd=self.cost_usd, branch=self.branch, commit=self.commit, pr_url=self.pr_url)
        except Exception as e:
            if self.cancelled.is_set():
                self._set("cancelled", cost_usd=self.cost_usd, branch=self.branch)
                return self
            self._set("failed", error=f"{type(e).__name__}: {e}", cost_usd=self.cost_usd)
            raise
        return self
