#!/usr/bin/env python3
"""Export class lecture decks to standalone reveal.js pages.

Source of truth is classes/<class>/{class.json,decks/*.html,assets/*}; this
script generates web/public/classes/ and nothing there should ever be edited by
hand (same contract as export_notebooks.py).

Each lesson gets web/public/classes/<class>/<lesson>/present.html — a standalone
page, deliberately NOT a Next.js route: reveal.css restyles html/body globally
and would wreck the app chrome, and PyScript needs to scan a real document.

reveal, KaTeX, html2canvas and jsPDF are vendored once into
web/public/classes/_shared/ and shared by every lesson.

Usage:
  python export_decks.py          # regenerate web/public/classes/
  python export_decks.py --check  # verify no drift (exit 1 if stale)
  python export_decks.py --watch  # rebuild on every save while authoring slides

Authoring loop: run --watch, edit classes/<class>/decks/<deck>.html by hand, and
keep the lesson open at .../present.html?dev=1 — the page polls its own ETag and
reloads itself when the watcher rewrites it. There is no separate dev renderer:
what the browser shows is the same file that ships.
"""

from __future__ import annotations

import argparse
import datetime
import fnmatch
import hashlib
import json
import os
import re
import shutil
import sys
import time
import tomllib
from pathlib import Path

ROOT = Path(__file__).parent
CLASSES = ROOT / "classes"
NOTEBOOKS = ROOT / "notebooks"
WEB = ROOT / "web"
OUT_BASE = WEB / "public" / "classes"
SHARED = OUT_BASE / "_shared"
VENDOR = ROOT / "tools" / "present" / "vendor"
PRESENT_SRC = ROOT / "tools" / "present"
NODE_MODULES = WEB / "node_modules"

SHARED_URL = "/classes/_shared"
PYSCRIPT = "https://pyscript.net/releases/2024.11.1"

# Our own present-mode files, copied verbatim into _shared/.
PRESENT_FILES = ("annotate.js", "fitslides.js", "devreload.js", "present.css")

# reveal defaults. Fixed pixel dimensions (rather than the source decks'
# width:'100%') are what make ink coordinates stable: the slide box keeps one
# aspect ratio at any window size, so normalized strokes always land right.
REVEAL_DEFAULTS = {
    "hash": True,
    "width": 1280,
    "height": 720,
    "margin": 0.04,
    "minScale": 0.2,
    "maxScale": 2.0,
    "center": True,
}


# ------------------------------------------------------------------ manifests

def load_classes() -> list[dict]:
    manifest = json.loads((CLASSES / "manifest.json").read_text(encoding="utf-8"))
    out = []
    for entry in sorted(manifest["classes"], key=lambda c: c.get("order", 100)):
        cfg = json.loads(
            (CLASSES / entry["slug"] / "class.json").read_text(encoding="utf-8")
        )
        cfg["_meta"] = entry
        out.append(cfg)
    return out


def known_content_ids() -> tuple[set[str], set[str]]:
    """(problem ids, notebook ids) used to reject dead practice links."""
    problems: set[str] = set()
    pm = WEB / "public" / "content" / "manifest.json"
    if pm.is_file():
        problems = {p["id"] for p in json.loads(pm.read_text(encoding="utf-8"))["problems"]}
    notebooks: set[str] = set()
    nm = NOTEBOOKS / "manifest.json"
    if nm.is_file():
        for sec in json.loads(nm.read_text(encoding="utf-8"))["sections"]:
            notebooks |= {f"{sec['slug']}/{nb['slug']}" for nb in sec["notebooks"]}
    return problems, notebooks


def item_href(item: dict) -> str:
    kind = "problems" if item["type"] == "problem" else "notebooks"
    return f"/{kind}/{item['id']}"


def group_title(pattern: str, ids: list[str]) -> str:
    """A human label for an expanded pattern.

    One topic ("py_basics/*") names itself; a pattern spanning several
    ("py_*") is labelled by the shared prefix, which is exactly how the
    problems sidebar groups them.
    """
    topics = sorted({i.split("/")[0] for i in ids})
    if len(topics) == 1:
        return topics[0]
    prefix = pattern.split("*")[0].rstrip("_/")
    return f"{prefix}_*" if prefix else pattern


def expand_item(item: dict, problems: set[str], notebooks: set[str],
                where: str) -> tuple[dict | None, list[str]]:
    """Resolve one practice/homework entry, expanding an id with a `*` in it.

    A wildcard becomes a *group*: one entry the UI can render as a single line
    ("py_* — 26 tasks, 4 done") instead of 26 separate rows. Expansion happens
    here, at export time, so the published manifest is an explicit list — the set
    of tasks a homework refers to cannot quietly change under the students, and
    CI's --check notices when adding a task changes an existing assignment.

    fnmatch semantics, where `*` also crosses the `/`: "py_basics/*" is one
    topic, "py_*" is every topic starting with py_.
    """
    kind = item["type"]
    if kind not in ("problem", "notebook"):
        return None, [f"{where}: unknown item type {kind!r}"]
    pool = problems if kind == "problem" else notebooks

    if "*" not in item["id"]:
        if item["id"] not in pool:
            return None, [f"{where}: unknown {kind} id {item['id']!r}"]
        return {"type": kind, "id": item["id"]}, []

    ids = sorted(fnmatch.filter(pool, item["id"]))
    if not ids:
        return None, [f"{where}: pattern {item['id']!r} matches no {kind}"]
    return {
        "type": "group",
        "of": kind,
        "pattern": item["id"],
        "title": item.get("title") or group_title(item["id"], ids),
        "items": [{"type": kind, "id": i} for i in ids],
    }, []


def expand_items(items: list[dict], problems: set[str], notebooks: set[str],
                 where: str) -> tuple[list[dict], list[str]]:
    out, errors = [], []
    for it in items:
        resolved, errs = expand_item(it, problems, notebooks, where)
        errors += errs
        if resolved:
            out.append(resolved)
    return out, errors


def lesson_items(lesson: dict, problems: set[str], notebooks: set[str],
                 where: str) -> tuple[list[dict], list[dict], list[str]]:
    """(practice, homework items, errors) with every pattern expanded."""
    practice, e1 = expand_items(lesson.get("practice", []), problems, notebooks,
                               f"{where} practice")
    hw = (lesson.get("homework") or {}).get("items", [])
    homework, e2 = expand_items(hw, problems, notebooks, f"{where} homework")
    return practice, homework, e1 + e2


def validate_items(cls: dict, problems: set[str], notebooks: set[str]) -> list[str]:
    """Check every practice/homework id in class.json resolves to real content."""
    errors = []
    # `"draft": "true"` would be silently truthy in JS and silently ignored here,
    # so a class could sit hidden (or exposed) because of a typo in a quote.
    if "draft" in cls and not isinstance(cls["draft"], bool):
        errors.append(f"{cls['slug']}: \"draft\" must be true or false, "
                      f"got {cls['draft']!r}")
    for lesson in cls["lessons"]:
        _, _, errs = lesson_items(lesson, problems, notebooks,
                                  f"{cls['slug']}/{lesson['slug']}")
        errors += errs
    return errors


def describe_groups(cls: dict, problems: set[str], notebooks: set[str]) -> list[str]:
    """Build-log lines for the patterns a class uses, so an expansion is visible."""
    lines = []
    for lesson in cls["lessons"]:
        practice, homework, _ = lesson_items(lesson, problems, notebooks, "")
        for label, items in (("practice", practice), ("homework", homework)):
            for it in items:
                if it["type"] == "group":
                    lines.append(f"{lesson['slug']} {label}: {it['pattern']} → "
                                 f"{len(it['items'])} {it['of']}s ({it['title']})")
    return lines


def validate_matplotlib_backend(slides: str, where: str) -> list[str]:
    """Require matplotlib.use('Agg') before pyplot is imported.

    PyScript runs editors in a worker, where matplotlib's default Pyodide
    backend does `from js import document` and dies with an ImportError the
    moment you call plt.subplots(). The decks all save figures to files, so a
    non-interactive backend is what they want anyway — but it has to be selected
    before the first pyplot import in that interpreter.

    Tracked per `env`, in document order, because editors sharing an env share
    one interpreter.
    """
    errors = []
    ready: set[str] = set()          # envs that already selected a backend
    for i, m in enumerate(re.finditer(
            r'<script\s+type="py-editor"([^>]*)>(.*?)</script>', slides, re.S)):
        env_m = re.search(r'env="([^"]*)"', m.group(1))
        # No env means a private interpreter, so it must set the backend itself.
        env = env_m.group(1) if env_m else f"__solo{i}"
        body = m.group(2)
        uses = re.search(r"matplotlib\.use\(", body)
        imports = re.search(r"(import\s+matplotlib\.pyplot|from\s+matplotlib\s+import\s+pyplot)",
                            body)
        if uses and (not imports or uses.start() < imports.start()):
            ready.add(env)
        elif imports and env not in ready:
            errors.append(
                f"{where}: py-editor #{i} (env {env_m.group(1) if env_m else 'none'}) "
                f"imports pyplot before matplotlib.use('Agg') — plt.subplots() "
                f"will fail in the worker with \"cannot import name 'document'\""
            )
            ready.add(env)           # one message per env is enough
    return errors


def validate_practice_links(slides: str, where: str,
                            problems: set[str], notebooks: set[str]) -> list[str]:
    """Check in-slide <a class="practice" href="/problems/…"> targets."""
    errors = []
    for m in re.finditer(r'<a\b[^>]*class="[^"]*\bpractice\b[^"]*"[^>]*>', slides):
        href = re.search(r'href="([^"]*)"', m.group(0))
        if not href:
            errors.append(f"{where}: a.practice without href")
            continue
        path = href.group(1).split("#")[0].split("?")[0].strip("/")
        parts = path.split("/")
        if len(parts) == 3 and parts[0] == "problems":
            if f"{parts[1]}/{parts[2]}" not in problems:
                errors.append(f"{where}: unknown problem link /{path}")
        elif len(parts) == 3 and parts[0] == "notebooks":
            if f"{parts[1]}/{parts[2]}" not in notebooks:
                errors.append(f"{where}: unknown notebook link /{path}")
        else:
            errors.append(f"{where}: a.practice href is not a problem/notebook "
                          f"path: /{path}")

    # Slides get authored against a local server; such a link works for the
    # lecturer and is dead for everyone in the room.
    for m in re.finditer(r'href="(https?://(?:localhost|127\.0\.0\.1|0\.0\.0\.0)[^"]*)"',
                         slides):
        errors.append(f"{where}: link to the dev server, use a site-relative "
                      f"path or https://www.mlpractice.com — {m.group(1)}")
    return errors


def validate_py_configs(slides: str, class_slug: str, where: str) -> list[str]:
    """Check every py-editor config toml, and the data files it declares, exist.

    PyScript mounts a `[files]` entry it cannot fetch as an **empty** file, so a
    wrong path shows up as a slide quietly printing nothing rather than as an
    error — worth failing the build over.
    """
    errors = []
    prefix = f"/classes/{class_slug}/assets/"
    for m in re.finditer(r'config="([^"]+\.toml)"', slides):
        url = m.group(1)
        if not url.startswith(prefix):
            errors.append(f"{where}: py-editor config {url!r} is not in the "
                          f"class assets dir")
            continue
        toml = CLASSES / class_slug / "assets" / url[len(prefix):]
        if not toml.is_file():
            errors.append(f"{where}: missing py-editor config {toml.name}")
            continue
        try:
            files = tomllib.loads(toml.read_text(encoding="utf-8")).get("files", {})
        except tomllib.TOMLDecodeError as e:
            errors.append(f"{where}: {toml.name} is not valid TOML ({e})")
            continue
        for key in files:
            # Keys resolve against the toml's own URL, i.e. the assets dir.
            if key.startswith(("http://", "https://")):
                continue
            if not (toml.parent / key).is_file():
                errors.append(
                    f"{where}: {toml.name} declares [files] {key!r}, which "
                    f"resolves to {prefix}{key} and does not exist "
                    f"(PyScript would mount it as an empty file)"
                )
    return errors


# --------------------------------------------------------------------- shared

def write_if_changed(path: Path, text: str) -> bool:
    """Write only when the bytes differ. Returns True if the file was touched.

    Keeping mtimes still on a no-op rebuild is what makes the ?dev=1 reloader
    usable: it watches this page's ETag, which Next derives from size+mtime, so
    rewriting all ten lessons on every save would reload every open tab.

    The write goes through a temp file and an atomic rename: `--watch` rebuilds
    while the dev server is serving these very files, and a plain overwrite
    truncates first — a page fetched at that instant would arrive half-written.
    """
    data = text.encode("utf-8")
    if path.is_file() and path.read_bytes() == data:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_bytes(data)
    os.replace(tmp, path)
    return True


def copy_tree(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if src.is_dir():
        shutil.copytree(src, dest, dirs_exist_ok=True)
    else:
        shutil.copy2(src, dest)


def build_shared() -> None:
    SHARED.mkdir(parents=True, exist_ok=True)
    for rel in ["reveal.js", "reveal.css", "reset.css", "theme/sky.css",
                "plugin/highlight/highlight.js", "plugin/highlight/monokai.css",
                "plugin/markdown/markdown.js", "plugin/math/math.js",
                "plugin/notes/notes.js"]:
        copy_tree(VENDOR / "reveal" / rel, SHARED / rel)
    copy_tree(VENDOR / "utils.js", SHARED / "utils.js")
    for name in PRESENT_FILES:
        copy_tree(PRESENT_SRC / name, SHARED / name)
    (SHARED / "ATTRIBUTION.txt").write_text(
        "reveal.js — MIT, Copyright (C) 2011-2023 Hakim El Hattab and contributors\n"
        "  https://revealjs.com/\n"
        "KaTeX — MIT, Copyright (c) 2013-2020 Khan Academy and contributors\n"
        "html2canvas — MIT, Copyright (c) 2012 Niklas von Hertzen\n"
        "jsPDF — MIT, Copyright (c) 2010-2021 James Hall, yWorks GmbH\n"
        "\nGenerated by export_decks.py — do not edit.\n",
        encoding="utf-8",
    )
    build_katex()
    build_js_vendor()


def build_katex() -> None:
    """Self-host KaTeX so slide math renders without a CDN round-trip.

    The reveal math plugin takes a `katex.local` base URL and appends
    /dist/... , so the layout below mirrors the npm package. Only woff2 fonts
    are copied: katex.min.css lists woff2 first, so no browser we care about
    ever asks for the ttf/woff variants.
    """
    src = NODE_MODULES / "katex" / "dist"
    if not src.is_dir():
        raise SystemExit("katex not found in web/node_modules — run `pnpm install` in web/")
    dist = SHARED / "katex" / "dist"
    (dist / "contrib").mkdir(parents=True, exist_ok=True)
    (dist / "fonts").mkdir(parents=True, exist_ok=True)
    copy_tree(src / "katex.min.css", dist / "katex.min.css")
    copy_tree(src / "katex.min.js", dist / "katex.min.js")
    copy_tree(src / "contrib" / "auto-render.min.js", dist / "contrib" / "auto-render.min.js")
    for font in sorted((src / "fonts").glob("*.woff2")):
        copy_tree(font, dist / "fonts" / font.name)


def build_js_vendor() -> None:
    out = SHARED / "vendor"
    out.mkdir(parents=True, exist_ok=True)
    wanted = {
        "html2canvas.min.js": NODE_MODULES / "html2canvas" / "dist" / "html2canvas.min.js",
        "jspdf.umd.min.js": NODE_MODULES / "jspdf" / "dist" / "jspdf.umd.min.js",
    }
    for name, src in wanted.items():
        if not src.is_file():
            raise SystemExit(f"{name} not found ({src}) — run `pnpm install` in web/")
        copy_tree(src, out / name)


# ----------------------------------------------------------------- page build

def deck_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]


def split_fragment(text: str) -> tuple[str, str, str]:
    """Return (title, head_style, slides_markup) from an imported fragment."""
    title_m = re.search(r"<!--\s*title:\s*(.*?)\s*-->", text)
    title = title_m.group(1) if title_m else "Lecture"
    styles = "\n".join(m.group(0) for m in re.finditer(r"<style>.*?</style>", text, re.S))
    slides = re.sub(r"<style>.*?</style>", "", text, flags=re.S)
    slides = re.sub(r"<!--.*?-->", "", slides, flags=re.S, count=2).strip()
    return title, styles, slides


def reveal_config(lesson: dict) -> str:
    cfg = dict(REVEAL_DEFAULTS)
    cfg.update(lesson.get("revealOverrides") or {})
    cfg["katex"] = {"local": f"{SHARED_URL}/katex"}
    return json.dumps(cfg, indent=6)


SHELL = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="viewport" content="width=device-width, initial-scale=1.0, \
maximum-scale=1.0, user-scalable=no, minimal-ui">
<meta name="robots" content="noindex">
<title>{title}</title>
<!-- Generated by export_decks.py from {source} — do not edit. -->
<link rel="stylesheet" href="{shared}/reset.css">
<link rel="stylesheet" href="{shared}/reveal.css">
<link rel="stylesheet" href="{shared}/theme/sky.css">
<link rel="stylesheet" href="{shared}/plugin/highlight/monokai.css">
<link rel="stylesheet" href="{shared}/present.css">
{pyscript_head}{styles}
</head>
<body data-class="{class_slug}" data-lesson="{lesson_slug}" \
data-deck-hash="{deck_hash}" onload="totalWrapper();">
<div class="reveal">
{slides}
</div>
<script src="{shared}/reveal.js"></script>
<script src="{shared}/plugin/notes/notes.js"></script>
<script src="{shared}/plugin/markdown/markdown.js"></script>
<script src="{shared}/plugin/highlight/highlight.js"></script>
<script src="{shared}/plugin/math/math.js"></script>
<script src="{shared}/utils.js"></script>
<script src="{shared}/vendor/html2canvas.min.js"></script>
<script src="{shared}/vendor/jspdf.umd.min.js"></script>
<script>
Reveal.initialize(Object.assign({config}, {{
      plugins: [RevealMarkdown, RevealHighlight, RevealNotes, RevealMath.KaTeX]
}}));

// Carried over from the source decks: every one of them animated the letters of
// .typesetting blocks as fragments appeared (playAnimation lives in utils.js).
Reveal.addEventListener('fragmentshown', function (event) {{
  if (typeof lettersAnimate !== 'undefined' && lettersAnimate) {{
    [...event.fragment.getElementsByClassName('typesetting')]
      .forEach(function (el) {{ playAnimation(el); }});
  }}
}});
</script>
<script src="{shared}/fitslides.js"></script>
<script src="{shared}/annotate.js"></script>
<script src="{shared}/devreload.js"></script>
</body>
</html>
"""


def build_lesson(cls: dict, lesson: dict, problems: set[str],
                 notebooks: set[str]) -> list[str]:
    class_slug = cls["slug"]
    deck = lesson["deck"]
    src = CLASSES / class_slug / "decks" / f"{deck}.html"
    if not src.is_file():
        return [f"{class_slug}/{lesson['slug']}: missing deck file "
                f"{src.relative_to(ROOT)}"]

    text = src.read_text(encoding="utf-8")
    title, styles, slides = split_fragment(text)
    where = f"{class_slug}/{lesson['slug']}"
    errors = validate_practice_links(slides, where, problems, notebooks)
    errors += validate_matplotlib_backend(slides, where)
    if errors:
        return errors

    # Assets sit next to the deck under classes/<class>/assets/ and are served
    # from /classes/<class>/assets/, so make the relative refs absolute.
    slides = slides.replace('="assets/', f'="/classes/{class_slug}/assets/')

    errors = validate_py_configs(slides, class_slug, f"{class_slug}/{lesson['slug']}")
    if errors:
        return errors

    pyscript_head = ""
    if re.search(r'<script\s+type="py', slides):
        pyscript_head = (
            f'<link rel="stylesheet" href="{PYSCRIPT}/core.css">\n'
            f'<script type="module" src="{PYSCRIPT}/core.js"></script>\n'
        )

    html = SHELL.format(
        title=f"{lesson['title']} — {cls['title']}",
        source=src.relative_to(ROOT),
        shared=SHARED_URL,
        pyscript_head=pyscript_head,
        styles=styles,
        class_slug=class_slug,
        lesson_slug=lesson["slug"],
        deck_hash=deck_hash(src),
        slides=slides,
        config=reveal_config(lesson),
    )

    out = OUT_BASE / class_slug / lesson["slug"] / "present.html"
    write_if_changed(out, html)
    return []


def write_public_manifest(classes: list[dict]) -> Path:
    """Emit web/public/classes/manifest.json for the Next app to read.

    classes/ sits outside the web/ package, so it is not deployed to Vercel and
    cannot be read at request time — the same reason problems are published to
    public/content/. Teacher emails are deliberately left out: the DB copy
    seeded by sync-classes.cjs is the authorization source, and there is no
    reason to publish addresses on a CDN.
    """
    problems, notebooks = known_content_ids()

    def lesson_payload(cls: dict, lesson: dict) -> dict:
        practice, hw_items, _ = lesson_items(
            lesson, problems, notebooks, f"{cls['slug']}/{lesson['slug']}"
        )
        homework = lesson.get("homework")
        return {
            "slug": lesson["slug"],
            "title": lesson["title"],
            "date": lesson.get("date"),
            "deck": lesson["deck"],
            "practice": practice,
            "homework": {**homework, "items": hw_items} if homework else None,
        }

    payload = {
        "classes": [
            {
                "slug": c["slug"],
                "title": c["title"],
                "description": c["_meta"].get("description", ""),
                "order": c["_meta"].get("order", 100),
                "lessons": [lesson_payload(c, l) for l in c["lessons"]],
            }
            for c in classes
        ]
    }
    out = OUT_BASE / "manifest.json"
    write_if_changed(out, json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    return out


def stale_dirs(classes: list[dict]) -> list[Path]:
    """Exported class/lesson dirs with nothing behind them any more.

    Renaming a class slug would otherwise leave the old one published and
    reachable — the export only ever writes, so nothing would remove it.
    """
    if not OUT_BASE.is_dir():
        return []
    wanted = {c["slug"]: {l["slug"] for l in c["lessons"]} for c in classes}
    stale = []
    for d in sorted(OUT_BASE.iterdir()):
        if not d.is_dir() or d.name == SHARED.name:
            continue
        if d.name not in wanted:
            stale.append(d)
            continue
        keep = wanted[d.name] | {"assets"}
        stale += [s for s in sorted(d.iterdir()) if s.is_dir() and s.name not in keep]
    return stale


ASSET_REF_RE = re.compile(
    r'(?:src|href|poster|config|data-background-image|data-background-video)'
    r'="assets/([^"?#]+)'
)


def deck_assets(class_slug: str, deck: Path) -> set[str]:
    """Asset filenames one deck actually references.

    A pyscript toml counts twice over: the file itself, plus the data files its
    [files] table mounts (whose keys are relative to the toml, i.e. bare names).
    """
    names = set(ASSET_REF_RE.findall(deck.read_text(encoding="utf-8")))
    for name in list(names):
        if not name.endswith(".toml"):
            continue
        toml = CLASSES / class_slug / "assets" / name
        if not toml.is_file():
            continue
        try:
            files = tomllib.loads(toml.read_text(encoding="utf-8")).get("files", {})
        except tomllib.TOMLDecodeError:
            continue
        names |= {k for k in files if not k.startswith(("http://", "https://"))}
    return names


def needed_assets(cls: dict) -> set[str]:
    """Everything the class's *live* lessons reference.

    A class keeps decks for lessons it no longer lists (a course can be re-cut
    from term to term), and their images have no business being deployed.
    """
    out: set[str] = set()
    for lesson in cls["lessons"]:
        deck = CLASSES / cls["slug"] / "decks" / f"{lesson['deck']}.html"
        if deck.is_file():
            out |= deck_assets(cls["slug"], deck)
    return out


def copy_assets(cls: dict) -> tuple[int, int, list[str]]:
    """Publish only the assets the live lessons use. (copied, skipped, errors)"""
    src = CLASSES / cls["slug"] / "assets"
    dest = OUT_BASE / cls["slug"] / "assets"
    if not src.is_dir():
        return 0, 0, []
    wanted = needed_assets(cls)
    missing = sorted(n for n in wanted if not (src / n).is_file())
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)
    copied = 0
    for name in sorted(wanted):
        if (src / name).is_file():
            shutil.copy2(src / name, dest / name)
            copied += 1
    on_disk = sum(1 for p in src.iterdir() if p.is_file())
    errors = [f"{cls['slug']}: deck references assets/{n}, which does not exist"
              for n in missing]
    return copied, on_disk - copied, errors


# ----------------------------------------------------------------------- watch

def watch_snapshot() -> dict[Path, int]:
    """mtimes of everything a present page is built from."""
    paths: list[Path] = [CLASSES / "manifest.json"]
    for cls_dir in sorted(p for p in CLASSES.iterdir() if p.is_dir()):
        paths.append(cls_dir / "class.json")
        paths += sorted((cls_dir / "decks").glob("*.html"))
        paths += sorted(p for p in (cls_dir / "assets").glob("*") if p.is_file())
    for name in PRESENT_FILES:
        paths.append(PRESENT_SRC / name)
    snap: dict[Path, int] = {}
    for p in paths:
        try:
            snap[p] = p.stat().st_mtime_ns
        except OSError:
            pass          # mid-save or deleted; the next tick will see it
    return snap


def rebuild_changed(changed: set[Path]) -> None:
    """React to one batch of edits, doing as little work as possible."""
    ts = datetime.datetime.now().strftime("%H:%M:%S")

    def log(msg: str) -> None:
        print(f"[{ts}] {msg}", flush=True)

    # A lesson list may have appeared or moved, so metadata is the one case that
    # cannot be handled incrementally.
    if any(p.name in ("manifest.json", "class.json") for p in changed):
        log("class metadata changed → full rebuild")
        build()
        return

    try:
        classes = load_classes()
    except (OSError, ValueError) as e:
        log(f"classes/ JSON not readable yet: {e}")
        return
    problems, notebooks = known_content_ids()

    if any(p.parent == PRESENT_SRC for p in changed):
        build_shared()
        log(f"present-mode scripts → {SHARED.relative_to(ROOT)}  "
            f"(reload the page: the reloader only watches the page itself)")

    for cls in classes:
        base = CLASSES / cls["slug"]
        if any(p.parent == base / "assets" for p in changed):
            n, skipped, _ = copy_assets(cls)
            log(f"{cls['slug']}: {n} assets re-copied ({skipped} unused)")
        decks = {p.stem for p in changed if p.parent == base / "decks"}
        for lesson in cls["lessons"]:
            if lesson["deck"] not in decks:
                continue
            errs = build_lesson(cls, lesson, problems, notebooks)
            for e in errs:
                log(f"✗ {e}")
            if errs:
                log("  (kept the previous page — fix the error and save again)")
                continue
            out = OUT_BASE / cls["slug"] / lesson["slug"] / "present.html"
            log(f"{cls['slug']}/{lesson['slug']} ← {lesson['deck']}.html "
                f"({out.stat().st_size // 1024} KB)")


def watch(interval: float) -> int:
    """Rebuild on every save, so decks can be hand-edited like plain HTML.

    The output is byte-for-byte what a plain `export_decks.py` produces — this is
    a trigger, not a second rendering path, so what you see while authoring is
    exactly what ships.
    """
    build()
    print(f"\nWatching classes/ and tools/present/ (every {interval:g}s). Ctrl-C to stop.")
    print("Open a lesson with ?dev=1 to have the browser reload itself, e.g.")
    for cls in load_classes():
        for lesson in cls["lessons"][:1]:
            print(f"  http://localhost:3000/classes/{cls['slug']}/"
                  f"{lesson['slug']}/present.html?dev=1")
    print("New lessons or classes still need the Next server restarted: it lists "
          "public/ at boot.\n", flush=True)

    prev = watch_snapshot()
    try:
        while True:
            time.sleep(interval)
            cur = watch_snapshot()
            changed = {p for p in cur if prev.get(p) != cur[p]}
            changed |= set(prev) - set(cur)
            if changed:
                prev = cur
                rebuild_changed(changed)
    except KeyboardInterrupt:
        print("\nstopped watching.")
        return 0


# --------------------------------------------------------------------- driver

def build() -> int:
    classes = load_classes()
    problems, notebooks = known_content_ids()
    errors: list[str] = []
    for cls in classes:
        errors += validate_items(cls, problems, notebooks)
    if errors:
        print("Refusing to export — dead content references:", file=sys.stderr)
        for e in errors:
            print(f"  {e}", file=sys.stderr)
        return 1

    total = sum(len(c["lessons"]) for c in classes)
    print(f"Exporting {total} lesson(s) from {len(classes)} class(es)…")
    for d in stale_dirs(classes):
        shutil.rmtree(d)
        print(f"  removed stale  {d.relative_to(ROOT)}")
    build_shared()
    print(f"  shared assets → {SHARED.relative_to(ROOT)}")
    print(f"  manifest      → {write_public_manifest(classes).relative_to(ROOT)}")

    for cls in classes:
        n, skipped, asset_errs = copy_assets(cls)
        errors += asset_errs
        note = f" ({skipped} unused, not published)" if skipped else ""
        # A draft class is still built in full: present.html is a static file, so
        # skipping it would mean the site's Publish button could not put a class
        # online without a deploy. Publication is decided in the DB, at request
        # time — see Class.publishedAt.
        draft = "  [draft in class.json]" if cls.get("draft") else ""
        print(f"  {cls['slug']}: {n} assets{note}{draft}")
        for line in describe_groups(cls, problems, notebooks):
            print(f"    ↳ {line}")
        for lesson in cls["lessons"]:
            errs = build_lesson(cls, lesson, problems, notebooks)
            if errs:
                errors += errs
                print(f"    {lesson['slug']} … FAILED")
                continue
            out = OUT_BASE / cls["slug"] / lesson["slug"] / "present.html"
            print(f"    {lesson['slug']} … ✓  ({out.stat().st_size // 1024} KB)")

    if errors:
        print("\nErrors:", file=sys.stderr)
        for e in errors:
            print(f"  {e}", file=sys.stderr)
        return 1
    print("Done.")
    return 0


def check() -> int:
    classes = load_classes()
    problems, notebooks = known_content_ids()
    errors: list[str] = []
    for cls in classes:
        errors += validate_items(cls, problems, notebooks)

    if not (SHARED / "reveal.js").is_file():
        errors.append(f"missing shared assets: {SHARED.relative_to(ROOT)}")

    pub = OUT_BASE / "manifest.json"
    if not pub.is_file():
        errors.append(f"missing: {pub.relative_to(ROOT)}")
    else:
        expected = json.loads(
            (OUT_BASE / "manifest.json").read_text(encoding="utf-8")
        )
        wanted = {c["slug"]: [l["slug"] for l in c["lessons"]] for c in classes}
        got = {c["slug"]: [l["slug"] for l in c["lessons"]]
               for c in expected["classes"]}
        if wanted != got:
            errors.append(f"stale: {pub.relative_to(ROOT)} (lessons differ)")
    for name in PRESENT_FILES:
        out = SHARED / name
        src = PRESENT_SRC / name
        if not out.is_file():
            errors.append(f"missing: {out.relative_to(ROOT)}")
        elif out.read_bytes() != src.read_bytes():
            errors.append(f"stale: {out.relative_to(ROOT)}")

    for d in stale_dirs(classes):
        errors.append(f"stale (no longer in the manifest): {d.relative_to(ROOT)}")

    total = 0
    for cls in classes:
        assets = CLASSES / cls["slug"] / "assets"
        if assets.is_dir():
            out_assets = OUT_BASE / cls["slug"] / "assets"
            wanted = needed_assets(cls)
            published = {p.name for p in out_assets.iterdir() if p.is_file()} \
                if out_assets.is_dir() else set()
            for name in sorted(wanted - published):
                errors.append(f"{cls['slug']}: asset not exported: {name}")
            for name in sorted(published - wanted):
                errors.append(f"{cls['slug']}: stale asset, nothing references "
                              f"it any more: {name}")
        for lesson in cls["lessons"]:
            total += 1
            out = OUT_BASE / cls["slug"] / lesson["slug"] / "present.html"
            deck = CLASSES / cls["slug"] / "decks" / f"{lesson['deck']}.html"
            if not deck.is_file():
                errors.append(f"{cls['slug']}/{lesson['slug']}: missing deck "
                              f"{deck.relative_to(ROOT)}")
                continue
            if not out.is_file():
                errors.append(f"missing: {out.relative_to(ROOT)}")
                continue
            if deck_hash(deck) not in out.read_text(encoding="utf-8"):
                errors.append(f"stale (deck changed): {out.relative_to(ROOT)}")

    if errors:
        print("Deck exports are out of date; run `python export_decks.py`:")
        for e in errors:
            print(f"  {e}")
        return 1
    print(f"Deck exports are up to date ({total} lessons).")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true",
                    help="verify exports without regenerating")
    ap.add_argument("--watch", action="store_true",
                    help="rebuild on every save (pair with ?dev=1 in the browser)")
    ap.add_argument("--interval", type=float, default=0.4, metavar="SEC",
                    help="how often --watch polls for edits (default: 0.4)")
    args = ap.parse_args()
    if args.check:
        return check()
    if args.watch:
        return watch(args.interval)
    return build()


if __name__ == "__main__":
    raise SystemExit(main())
