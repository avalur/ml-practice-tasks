#!/usr/bin/env python3
"""Generate the student-facing ``tasks/`` tree from authoritative ``problems/``.

For each problem we:
  * strip the reference solution body (between the solution markers) to make a
    ``submission.py`` stub that keeps the signature, docstring and imports;
  * copy ``test.py`` and ``meta.yaml`` verbatim;
  * render a ``README.md`` problem statement from ``meta.yaml``.

Run ``python generate.py`` to (re)build, or ``python generate.py --check`` to
verify the committed ``tasks/`` tree is up to date (used in CI).
"""

from __future__ import annotations

import argparse
import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).parent
PROBLEMS = ROOT / "problems"
TASKS = ROOT / "tasks"

BEGIN = "# --- solution: begin ---"
END = "# --- solution: end ---"
STUB = 'raise NotImplementedError("Your code here")'


def load_meta(path: Path) -> dict:
    spec = importlib.util.spec_from_file_location(f"meta_{path.parent.name}", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.META


def make_stub(reference_src: str) -> str:
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
    if constraints:
        parts.append("## Constraints\n\n" + "\n".join(constraints))
    parts.append(
        "## How to run\n\n```bash\n"
        f"pytest tasks/{topic}/{slug}\n```\n"
        "Edit `submission.py` until every test passes."
    )
    return "\n\n".join(p for p in parts if p) + "\n"


def build() -> dict[Path, str]:
    """Return the full desired contents of ``tasks/`` as {abs_path: text}."""
    files: dict[Path, str] = {}
    for ref in sorted(PROBLEMS.glob("*/*/reference.py")):
        problem_dir = ref.parent
        topic, slug = problem_dir.parts[-2], problem_dir.parts[-1]
        meta = load_meta(problem_dir / "meta.py")
        out_dir = TASKS / topic / slug
        files[out_dir / "submission.py"] = make_stub(ref.read_text())
        files[out_dir / "test.py"] = (problem_dir / "test.py").read_text()
        files[out_dir / "meta.py"] = (problem_dir / "meta.py").read_text()
        files[out_dir / "README.md"] = render_readme(meta, topic, slug)
    return files


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help="verify tasks/ matches problems/ without writing (exit 1 on drift)",
    )
    args = parser.parse_args()

    desired = build()
    if args.check:
        drift = [
            p for p, text in desired.items()
            if not p.exists() or p.read_text() != text
        ]
        if drift:
            print("tasks/ is out of date; run `python generate.py`:")
            for p in drift:
                print(f"  {p.relative_to(ROOT)}")
            return 1
        print(f"tasks/ is up to date ({len(desired)} files).")
        return 0

    for path, text in desired.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
    print(f"Generated {len(desired)} files for {len({p.parent for p in desired})} task(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
