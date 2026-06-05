#!/usr/bin/env python3
"""Generate the student-facing ``tasks/`` tree from authoritative ``problems/``.

Thin target over :mod:`content_pipeline`. For each problem we emit a
``submission.py`` stub (reference solution body stripped), copy ``test.py`` and
``meta.py`` verbatim, and render a ``README.md`` from ``meta.py``.

Run ``python generate.py`` to (re)build, or ``python generate.py --check`` to
verify the committed ``tasks/`` tree is up to date (used in CI).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from content_pipeline import ROOT, iter_problems

TASKS = ROOT / "tasks"


def build() -> dict[Path, str]:
    """Return the full desired contents of ``tasks/`` as {abs_path: text}."""
    files: dict[Path, str] = {}
    for b in iter_problems():
        out_dir = TASKS / b.topic / b.slug
        files[out_dir / "submission.py"] = b.stub_src
        files[out_dir / "test.py"] = b.test_src
        files[out_dir / "meta.py"] = b.meta_src
        files[out_dir / "README.md"] = b.readme_md
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
