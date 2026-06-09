"""Shared content pipeline — the single source of logic for turning the
authoritative ``problems/`` tree into derived artifacts.

Both targets are thin wrappers over this module, so there is exactly one place
that knows how to read a problem, strip the reference solution, render a README,
and validate metadata:

  * ``generate.py``   → student ``tasks/`` stubs
  * ``export_web.py`` → ``web/public/content`` bundles + manifest for the site

A problem lives in ``problems/<topic>/<slug>/`` with ``reference.py`` (full
solution; the body between the solution markers is strippable), ``test.py`` and
``meta.py`` (a ``META`` dict).
"""

from __future__ import annotations

import hashlib
import importlib.util
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).parent
PROBLEMS = ROOT / "problems"

BEGIN = "# --- solution: begin ---"
END = "# --- solution: end ---"
STUB = 'raise NotImplementedError("Your code here")'

_DIFFICULTIES = {"easy", "medium", "hard"}


def load_meta(path: Path) -> dict:
    spec = importlib.util.spec_from_file_location(f"meta_{path.parent.name}", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.META


def make_stub(reference_src: str) -> str:
    """Strip the reference solution body to produce the student stub."""
    lines = reference_src.splitlines()
    out: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.strip() == BEGIN:
            indent = line[: len(line) - len(line.lstrip())]
            out.append(f"{indent}{STUB}")
            i += 1
            while i < len(lines) and lines[i].strip() != END:
                i += 1
            i += 1  # skip the END marker
            continue
        out.append(line)
        i += 1
    return "\n".join(out).rstrip() + "\n"


def render_readme(meta: dict, topic: str, slug: str) -> str:
    banned = meta.get("banned") or {}
    parts = [
        f"# {meta.get('title', slug)}",
        f"**Topic:** `{topic}` &nbsp;|&nbsp; **Difficulty:** {meta.get('difficulty', '-')}",
        meta.get("statement", "").strip(),
    ]
    constraints = []
    if banned.get("modules"):
        constraints.append(f"- Forbidden modules: {', '.join(banned['modules'])}")
    if banned.get("names"):
        constraints.append(f"- Forbidden functions: {', '.join(banned['names'])}")
    if banned.get("loops"):
        constraints.append("- Explicit `for`/`while` loops are not allowed (vectorize it)")
    if banned.get("operators"):
        constraints.append(f"- Forbidden operators: {', '.join(banned['operators'])}")
    if banned.get("slicing"):
        constraints.append("- Slicing `seq[a:b]` is not allowed (plain indexing `seq[i]` is fine)")
    if constraints:
        parts.append("## Constraints\n\n" + "\n".join(constraints))
    parts.append(
        "## How to run\n\n```bash\n"
        f"pytest tasks/{topic}/{slug}\n```\n"
        "Edit `submission.py` until every test passes."
    )
    return "\n\n".join(p for p in parts if p) + "\n"


def validate_meta(meta: dict, topic: str, slug: str) -> None:
    """Fail loudly on malformed ``META`` (it is executed Python, so guard it)."""
    where = f"{topic}/{slug}: meta.py"
    required = ("title", "topic", "difficulty", "entry", "statement")
    missing = [k for k in required if k not in meta]
    if missing:
        raise ValueError(f"{where} missing required keys: {', '.join(missing)}")
    if meta["topic"] != topic:
        raise ValueError(f"{where} topic {meta['topic']!r} != directory {topic!r}")
    if meta["difficulty"] not in _DIFFICULTIES:
        raise ValueError(f"{where} difficulty {meta['difficulty']!r} not in {sorted(_DIFFICULTIES)}")
    if not isinstance(meta["entry"], str) or not meta["entry"]:
        raise ValueError(f"{where} entry must be a non-empty string")
    banned = meta.get("banned") or {}
    if not isinstance(banned, dict):
        raise ValueError(f"{where} banned must be a dict")
    py_deps = meta.get("py_deps", ["numpy"])
    if not isinstance(py_deps, (list, tuple)) or not all(isinstance(d, str) for d in py_deps):
        raise ValueError(f"{where} py_deps must be a list of strings")
    hints = meta.get("hints", [])
    if not isinstance(hints, (list, tuple)) or not all(isinstance(h, str) for h in hints):
        raise ValueError(f"{where} hints must be a list of strings")
    if not isinstance(meta.get("hidden", False), bool):
        raise ValueError(f"{where} hidden must be a bool")
    order = meta.get("order", 100)
    if not isinstance(order, int) or isinstance(order, bool) or order < 0:
        raise ValueError(f"{where} order must be a non-negative int")


@dataclass(frozen=True)
class ProblemBundle:
    """Everything the downstream targets need for one problem."""

    topic: str
    slug: str
    title: str
    difficulty: str
    entry: str
    banned: dict
    statement_md: str
    py_deps: tuple[str, ...]
    web_runnable: bool
    hidden: bool
    order: int
    hints: tuple[str, ...]
    reference_src: str
    stub_src: str
    test_src: str
    meta_src: str
    readme_md: str

    @property
    def id(self) -> str:
        return f"{self.topic}/{self.slug}"

    @property
    def content_hash(self) -> str:
        """Stable hash over the runtime-relevant files (detects content drift)."""
        h = hashlib.sha256()
        for part in (self.stub_src, self.test_src, self.meta_src):
            h.update(part.encode("utf-8"))
            h.update(b"\0")
        return h.hexdigest()


def iter_problems() -> list[ProblemBundle]:
    """Load and validate every problem, sorted deterministically by path."""
    bundles: list[ProblemBundle] = []
    for ref in sorted(PROBLEMS.glob("*/*/reference.py")):
        problem_dir = ref.parent
        topic, slug = problem_dir.parts[-2], problem_dir.parts[-1]
        meta = load_meta(problem_dir / "meta.py")
        validate_meta(meta, topic, slug)
        reference_src = ref.read_text()
        bundles.append(
            ProblemBundle(
                topic=topic,
                slug=slug,
                title=meta.get("title", slug),
                difficulty=meta["difficulty"],
                entry=meta["entry"],
                banned=meta.get("banned") or {},
                statement_md=meta.get("statement", "").strip(),
                py_deps=tuple(meta.get("py_deps", ["numpy"])),
                web_runnable=bool(meta.get("web_runnable", True)),
                hidden=bool(meta.get("hidden", False)),
                order=int(meta.get("order", 100)),
                hints=tuple(meta.get("hints", [])),
                reference_src=reference_src,
                stub_src=make_stub(reference_src),
                test_src=(problem_dir / "test.py").read_text(),
                meta_src=(problem_dir / "meta.py").read_text(),
                readme_md=render_readme(meta, topic, slug),
            )
        )
    # Order within a topic by the optional `order` field (then slug); topics
    # stay alphabetical. Drives catalog / sidebar / prev-next ordering.
    bundles.sort(key=lambda b: (b.topic, b.order, b.slug))
    return bundles
