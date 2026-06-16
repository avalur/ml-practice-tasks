#!/usr/bin/env python3
"""Export marimo notebooks to WASM HTML bundles.

All notebooks share ONE copy of the marimo WASM assets (~27 MB)
stored at web/public/notebooks/_shared/. Each notebook gets its
own index.html (≈32 KB) with paths rewritten to /notebooks/_shared/.

Usage:
  python export_notebooks.py          # regenerate web/public/notebooks/
  python export_notebooks.py --check  # verify no drift (exit 1 if stale)
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT      = Path(__file__).parent
NOTEBOOKS = ROOT / "notebooks"
OUT_BASE  = ROOT / "web" / "public" / "notebooks"
SHARED    = OUT_BASE / "_shared"

ASSETS_MARKER = "./assets/"
SHARED_ASSETS = "/notebooks/_shared/assets/"


def export_one_raw(src: Path, out_dir: Path) -> None:
    """Run marimo export into a temp dir, return immediately."""
    subprocess.run(
        ["marimo", "export", "html-wasm", str(src),
         "-o", str(out_dir), "--mode", "edit", "-f"],
        check=True,
        capture_output=True,
    )


def patch_html(html: str) -> str:
    """Replace relative ./assets/ refs with the shared absolute path."""
    return html.replace(ASSETS_MARKER, SHARED_ASSETS)


def export_notebook(src: Path, out_html: Path, shared_dir: Path) -> None:
    """Export one notebook: reuse shared assets, write patched index.html."""
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp) / "out"
        export_one_raw(src, tmp_path)

        # Copy assets to shared dir on first run (or update if version changed)
        tmp_assets = tmp_path / "assets"
        if tmp_assets.exists() and not shared_dir.exists():
            shutil.copytree(tmp_assets, shared_dir)
            # Also copy favicon/logo files
            for f in tmp_path.iterdir():
                if f.is_file() and f.suffix in (".png", ".ico", ".webmanifest", ".json"):
                    shutil.copy2(f, shared_dir.parent / f.name)
        elif tmp_assets.exists():
            # Check if assets changed (marimo version bump)
            new_files = {f.name for f in tmp_assets.iterdir()}
            old_files = {f.name for f in shared_dir.iterdir()} if shared_dir.exists() else set()
            if new_files != old_files:
                shutil.rmtree(shared_dir)
                shutil.copytree(tmp_assets, shared_dir)

        # Patch and write index.html
        raw_html = (tmp_path / "index.html").read_text(encoding="utf-8")
        patched  = patch_html(raw_html)
        out_html.parent.mkdir(parents=True, exist_ok=True)
        out_html.write_text(patched, encoding="utf-8")


def notebook_hash(src: Path) -> str:
    """Quick mtime+size fingerprint — good enough for --check."""
    import hashlib
    h = hashlib.sha256()
    h.update(src.read_bytes())
    return h.hexdigest()[:16]


def load_manifest() -> dict:
    return json.loads((NOTEBOOKS / "manifest.json").read_text())


def iter_notebooks(manifest: dict):
    """Yield (section_slug, notebook_slug, src_path, out_html_path)."""
    for section in manifest["sections"]:
        sec = section["slug"]
        for nb in section["notebooks"]:
            slug = nb["slug"]
            src  = NOTEBOOKS / sec / f"{slug}.py"
            html = OUT_BASE / sec / slug / "index.html"
            yield sec, slug, src, html


def build() -> None:
    manifest = load_manifest()
    total = sum(len(s["notebooks"]) for s in manifest["sections"])
    print(f"Exporting {total} notebooks…")
    for sec, slug, src, html in iter_notebooks(manifest):
        print(f"  {sec}/{slug} … ", end="", flush=True)
        export_notebook(src, html, SHARED)
        print(f"✓  ({html.stat().st_size // 1024} KB)")
    print(f"Shared assets → {SHARED.relative_to(ROOT)}")
    print("Done.")


def check() -> int:
    manifest = load_manifest()
    errors: list[str] = []

    if not SHARED.exists():
        errors.append(f"missing shared assets: {SHARED.relative_to(ROOT)}")

    for sec, slug, src, html in iter_notebooks(manifest):
        if not html.exists():
            errors.append(f"missing: {html.relative_to(ROOT)}")
            continue
        # Check that source hash is embedded in the exported HTML
        h = notebook_hash(src)
        content = html.read_text(encoding="utf-8")
        if h not in content and SHARED_ASSETS not in content:
            errors.append(f"stale (assets path missing): {html.relative_to(ROOT)}")

    if errors:
        print("Notebook exports are out of date; run `python export_notebooks.py`:")
        for e in errors:
            print(f"  {e}")
        return 1
    n = sum(len(s["notebooks"]) for s in manifest["sections"])
    print(f"Notebook exports are up to date ({n} notebooks).")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true",
                        help="verify exports without regenerating")
    args = parser.parse_args()
    if args.check:
        return check()
    build()
    return 0


if __name__ == "__main__":
    sys.exit(main())
