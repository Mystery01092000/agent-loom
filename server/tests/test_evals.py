from evals.run import load_cases, run_case, table
from tests.fake_client import FakeClient, text, tool_use, turn
from tests.test_lifecycle import DIAG_OK, INTAKE

CALC = "def add(a, b):\n    return a + b\n\n\ndef subtract(a, b):\n    return a - b\n"
TEST = "from calc import add, subtract\n\n\ndef test_both():\n    assert add(1, 2) == 3 and subtract(5, 3) == 2\n"


def _turns(good: bool):
    return [
        turn(text(INTAKE)),
        turn(tool_use("spawn_worker", {"task": "t", "context": "c"})),
        turn(tool_use("write_file", {"path": "calc.py", "content": CALC if good else "def add(a, b):\n    return a + b\n"}, "tu_1")),
        turn(tool_use("write_file", {"path": "test_calc.py", "content": TEST}, "tu_2")),
        turn(text("done")),
        turn(text("sup done")),
        turn(text(DIAG_OK)),
        turn(text("sum\nTITLE: t")),
    ]


def test_cases_load():
    names = [c["name"] for c in load_cases()]
    assert {"python-subtract", "python-bugfix", "go-todo-api"} <= set(names)
    assert load_cases(["python-subtract"])[0]["checks"]


def test_run_case_pass_and_fail():
    case = load_cases(["python-subtract"])[0]
    ok = run_case(case, FakeClient(_turns(True)))
    assert ok["passed"] and ok["state"] == "done" and all(c["ok"] for c in ok["checks"]) and ok["cost_usd"] > 0
    bad = run_case(case, FakeClient(_turns(False)))
    assert not bad["passed"] and bad["state"] == "done" and not bad["checks"][0]["ok"]
    md = table([ok, bad])
    assert "| python-subtract | yes |" in md and "| python-subtract | NO |" in md and "1/2" in md
