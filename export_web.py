#!/usr/bin/env python3
"""Export ``web/public/content`` for the website from authoritative ``problems/``.

Thin target over :mod:`content_pipeline`. The generated content is **committed**
to the repo (so the Vercel build runs no Python); CI runs
``python export_web.py --check`` to guarantee it never drifts from ``problems/``.

Per ``web_runnable`` problem we emit exactly what the in-browser Pyodide runner
needs to run pytest, plus a ``meta.json`` the Next.js app reads directly and a
top-level ``manifest.json`` listing every problem. The reference solution is
exported as ``reference.py`` (solution markers stripped) so the UI can show it
after a student passes all tests.

Run ``python export_web.py`` to (re)build, or ``--check`` to verify (exit 1 on
drift, including stray files left by removed problems).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from content_pipeline import ROOT, ProblemBundle, iter_problems, strip_markers

WEB_CONTENT = ROOT / "web" / "public" / "content"

# Shared files, mounted once by the runner alongside each problem bundle. Kept
# byte-identical to the repo so the browser reproduces the exact test harness.
SHARED_SRC = {
    "_shared/conftest.py": ROOT / "conftest.py",
    "_shared/pytest.ini": ROOT / "pytest.ini",
    "_shared/tools/__init__.py": ROOT / "tools" / "__init__.py",
    "_shared/tools/checks.py": ROOT / "tools" / "checks.py",
}


def manifest_entry(b: ProblemBundle) -> dict:
    """The per-problem record used both in manifest.json and the bundle meta.json."""
    return {
        "id": b.id,
        "topic": b.topic,
        "slug": b.slug,
        "title": b.title,
        "difficulty": b.difficulty,
        "entry": b.entry,
        "banned": b.banned,
        "statementMd": b.statement_md,
        "bundlePath": f"/content/problems/{b.topic}/{b.slug}",
        "pyDeps": list(b.py_deps),
        "webRunnable": b.web_runnable,
        "hidden": b.hidden,
        "hints": list(b.hints),
        "prereqs": list(b.prereqs),
        "next": list(b.next_tasks),
        "contentHash": b.content_hash,
    }


def _json(obj: object) -> str:
    return json.dumps(obj, indent=2, ensure_ascii=False) + "\n"


def build() -> dict[Path, str]:
    """Return the full desired contents of web/public/content as {abs_path: text}."""
    files: dict[Path, str] = {}
    for rel, src in SHARED_SRC.items():
        files[WEB_CONTENT / rel] = src.read_text()

    bundles = iter_problems()
    entries = []
    for b in bundles:
        d = WEB_CONTENT / "problems" / b.topic / b.slug
        files[d / "submission.py"] = b.stub_src
        files[d / "reference.py"] = strip_markers(b.reference_src)
        files[d / "test.py"] = b.test_src
        files[d / "meta.py"] = b.meta_src
        files[d / "readme.md"] = b.readme_md
        entry = manifest_entry(b)
        files[d / "meta.json"] = _json(entry)
        entries.append(entry)

    files[WEB_CONTENT / "manifest.json"] = _json({
        "topics": sorted({b.topic for b in bundles}),
        "difficulties": ["easy", "medium", "hard"],
        "problems": entries,
    })
    return files


def _existing_files() -> set[Path]:
    if not WEB_CONTENT.exists():
        return set()
    return {p for p in WEB_CONTENT.rglob("*") if p.is_file()}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help="verify web content matches problems/ without writing (exit 1 on drift)",
    )
    args = parser.parse_args()

    desired = build()
    if args.check:
        drift = [
            p for p, text in desired.items()
            if not p.exists() or p.read_text() != text
        ]
        stray = sorted(_existing_files() - set(desired))
        if drift or stray:
            print("web content is out of date; run `python export_web.py`:")
            for p in sorted(drift):
                print(f"  changed/missing: {p.relative_to(ROOT)}")
            for p in stray:
                print(f"  stray: {p.relative_to(ROOT)}")
            return 1
        print(f"web content is up to date ({len(desired)} files).")
        return 0

    for path, text in desired.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
    for path in _existing_files() - set(desired):  # propagate deletions
        path.unlink()
    print(f"Generated {len(desired)} files into {WEB_CONTENT.relative_to(ROOT)}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
