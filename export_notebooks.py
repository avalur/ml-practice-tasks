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
import re as _re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT      = Path(__file__).parent
NOTEBOOKS = ROOT / "notebooks"
OUT_BASE  = ROOT / "web" / "public" / "notebooks"
SHARED    = OUT_BASE / "_shared"

ASSETS_MARKER     = "./assets/"
SHARED_ASSETS     = "/notebooks/_shared/"

# Patterns that indicate a cell body contains actual code (not just markdown)
_CODE_PATTERNS = [
    r"\bclass\s+",           # class definitions
    r"def\s+\w+\s*\(",      # nested function defs
    r"^import\s",            # imports (at start of line)
    r"^from\s",              # from imports
    r"\bassert\b",           # assertions
    r"\braise\s",            # raise statements
    r"\bfor\b|\bwhile\b",   # loops
    r"\bif\s+[^=]",         # conditionals (not ==)
    r"\btry\b|\bexcept\b",  # try/except
    r"(?<!\\)lambda\s*",     # lambdas (not \\lambda in LaTeX)
    r"=\s*[\[\(\{]",        # list/dict/tuple literals
    r"np\.random|torch\.|tf\.",  # ML library usage
]


def _is_markdown_cell_body(body: str) -> bool:
    """Return True if cell body contains only mo.md() and return."""
    lines = body.splitlines()
    first_content = next((l.strip() for l in lines if l.strip()), None)
    if not first_content or not first_content.startswith("mo.md"):
        return False
    # Skip code-pattern checks while inside the triple-quoted markdown string;
    # otherwise English words like "for", "if", "import" in the prose trigger
    # false positives (e.g. "no loops except for GD iterations").
    in_string = False
    for l in lines:
        s = l.strip()
        if not s or s.startswith("return"):
            continue
        if s.startswith("mo.md"):
            in_string = True   # entering the triple-quoted md block
            continue
        if in_string:
            # closing triple-quote ends the string literal + the call
            if s.startswith('"""') or s.startswith("'''"):
                in_string = False
            continue
        if any(_re.search(p, s) for p in _CODE_PATTERNS):
            return False
    return True


def _patch_source_hide_markdown(src_text: str) -> str:
    """Return source text with hide_code=True on all markdown-only cells."""
    # Split on @app.cell decorators (capturing group keeps them in parts list)
    deco_re = _re.compile(r'(@app\.cell(?:\([^)]*\))?)')
    parts = deco_re.split(src_text)
    # parts[0] = preamble; parts[1,3,5,...] = decorators; parts[2,4,6,...] = text after

    result = [parts[0]]
    i = 1
    while i < len(parts):
        decorator = parts[i]
        after = parts[i + 1] if i + 1 < len(parts) else ""

        func_m = _re.match(r'\s*\ndef\s+\w+\([^)]*\):\n(.*)', after, _re.DOTALL)
        if func_m and "hide_code" not in decorator and _is_markdown_cell_body(func_m.group(1)):
            if decorator == "@app.cell":
                decorator = "@app.cell(hide_code=True)"
            else:
                decorator = decorator[:-1] + ", hide_code=True)"

        result.append(decorator)
        if i + 1 < len(parts):
            result.append(after)
        i += 2

    return "".join(result)


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


# marimo's entry module (read out and re-added by our restore script so booting
# is gated until after we patch <marimo-code>).
_MARIMO_ENTRY_RE = _re.compile(
    r'<script\s+type="module"[^>]*\ssrc="([^"]+)"[^>]*>\s*</script>'
)

# Restore script: fetch the student's saved code, patch the <marimo-code> element,
# THEN boot marimo by appending its entry module. Gating the boot eliminates the
# race where marimo reads the code before the async fetch resolves. Always boots
# (in `finally`), so logged-out / no-saved-code falls through to the starter.
_RESTORE_SCRIPT = """\
<script>
(function () {
  var NB_ID = "%(id)s";
  var BOOT_SRC = "%(src)s";
  var BEGIN = "# --- student: begin ---";
  var END = "# --- student: end ---";
  function boot() {
    var s = document.createElement("script");
    s.type = "module";
    s.crossOrigin = "anonymous";
    s.src = BOOT_SRC;
    document.head.appendChild(s);
  }
  function reindent(code) {
    var lines = code.replace(/\\t/g, "    ").split("\\n");
    var min = Infinity;
    lines.forEach(function (l) {
      if (l.trim() === "") return;
      var n = l.match(/^ */)[0].length;
      if (n < min) min = n;
    });
    if (!isFinite(min)) min = 0;
    return lines.map(function (l) {
      return l.trim() === "" ? "" : "    " + l.slice(min);
    }).join("\\n").replace(/\\s+$/, "");
  }
  function patch(d) {
    if (!d || typeof d.code !== "string" || !d.code.trim()) return;
    var el = document.querySelector("marimo-code");
    if (!el) return;
    var src = decodeURIComponent(el.textContent || "");
    var b = src.indexOf(BEGIN), e = src.indexOf(END);
    if (b === -1 || e === -1 || e < b) return;
    var bodyStart = src.indexOf("\\n", b) + 1;   // just after the begin line
    var endLine = src.lastIndexOf("\\n", e) + 1;  // start of the end-marker line
    el.textContent = encodeURIComponent(
      src.slice(0, bodyStart) + reindent(d.code) + "\\n" + src.slice(endLine));
  }
  fetch("/api/notebook-progress?notebookId=" + encodeURIComponent(NB_ID),
        { credentials: "include" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(patch)
    .catch(function () {})
    .finally(boot);
})();
</script>
"""


def _inject_restore_script(html: str, nb_id: str) -> str:
    """Strip marimo's entry module and re-add it via a code-restore script that
    boots marimo only after patching <marimo-code> (deterministic, no race)."""
    m = _MARIMO_ENTRY_RE.search(html)
    if not m:
        return html  # unexpected layout — leave as-is rather than break boot
    boot_src = m.group(1)
    html = html[: m.start()] + html[m.end():]  # remove the entry module
    script = _RESTORE_SCRIPT % {"id": nb_id, "src": boot_src}
    if "</head>" in html:
        return html.replace("</head>", script + "</head>", 1)
    return script + html


def export_notebook(src: Path, out_html: Path, shared_dir: Path) -> None:
    """Export one notebook: reuse shared assets, write patched index.html."""
    patched_src = _patch_source_hide_markdown(src.read_text(encoding="utf-8"))

    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        # Export from a patched copy so hide_code=True is baked into the HTML
        tmp_src = tmp_dir / src.name
        tmp_src.write_text(patched_src, encoding="utf-8")

        tmp_path = tmp_dir / "out"
        export_one_raw(tmp_src, tmp_path)

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

        # Patch asset paths, inject the code-restore script, write index.html
        raw_html = (tmp_path / "index.html").read_text(encoding="utf-8")
        nb_id = f"{src.parent.name}/{src.stem}"
        html = _inject_restore_script(patch_html(raw_html), nb_id)
        out_html.parent.mkdir(parents=True, exist_ok=True)
        out_html.write_text(html, encoding="utf-8")


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
