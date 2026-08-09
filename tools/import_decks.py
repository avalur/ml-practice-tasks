#!/usr/bin/env python3
"""Import a reveal.js deck from avalur.github.io into classes/<class>/decks/.

Run once per deck you bring over — this is NOT part of the regular build
(that's export_decks.py). The imported file is a *fragment*: the deck's own
<style> plus the <div class="slides"> markup, with no <html>/<head>. The
exporter supplies the page shell, so present.html can force a fixed reveal
size (needed for stable ink coordinates) instead of the source's width:'100%'.

What survives verbatim: every <section>, fragments, aside.notes,
data-background-*, and the <script type="py-editor"> PyScript blocks that live
inside slides — those are lecture content, not page behaviour.

What is dropped: page-level <script> tags (the deck's own Reveal.initialize and
the matrix easter-egg canvas). Anything dropped is reported, never silent.

Images and PyScript .toml configs referenced by the deck are copied into
classes/<class>/assets/ and rewritten to assets/<name>. Raster images wider
than --max-width are downscaled with Pillow (GIFs and SVGs are left alone).

Usage:
  python tools/import_decks.py --class ml-intensive-tlf --deck all
  python tools/import_decks.py --class ml-intensive-tlf --deck intro_to_python
"""

from __future__ import annotations

import argparse
import re
import shutil
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLASSES = ROOT / "classes"
DEFAULT_SRC = Path.home() / "IdeaProjects" / "avalur.github.io" / "ai_club"

RASTER_EXT = {".png", ".jpg", ".jpeg", ".webp"}
IMAGE_EXT = RASTER_EXT | {".gif", ".svg"}

# Paths that belong to reveal itself, not to deck content — never copied.
VENDOR_PREFIXES = ("../dist/", "../plugin/", "../scripts/", "dist/", "plugin/")


# ---------------------------------------------------------------- HTML slicing

def extract_slides(html: str, deck: str) -> str:
    """Return the full `<div class="slides">…</div>` element, depth-matched.

    Depth counting (rather than a greedy regex) is what keeps nested column
    divs inside slides intact.
    """
    m = re.search(r'<div\s+class="slides"\s*>', html)
    if not m:
        raise SystemExit(f"{deck}: no <div class=\"slides\"> found")
    start = m.start()
    depth = 0
    for tok in re.finditer(r"<div\b|</div\s*>", html[start:]):
        depth += 1 if tok.group(0).startswith("<div") else -1
        if depth == 0:
            return html[start : start + tok.end()]
    raise SystemExit(f"{deck}: <div class=\"slides\"> is never closed")


def extract_styles(html: str, slides: str) -> str:
    """Concatenate the deck's own <style> blocks (head styles, not slide markup)."""
    head = html.replace(slides, "")
    blocks = re.findall(r"<style>(.*?)</style>", head, re.S)
    return "\n".join(b.strip("\n") for b in blocks)


def report_dropped_scripts(html: str, slides: str, deck: str) -> None:
    """Print every page-level script that the fragment loses."""
    head = html.replace(slides, "")
    for m in re.finditer(r"<script\b([^>]*)>(.*?)</script>", head, re.S):
        attrs, body = m.group(1), m.group(2).strip()
        src = re.search(r'src="([^"]*)"', attrs)
        if src:
            if not src.group(1).startswith(VENDOR_PREFIXES):
                print(f"    dropped external script: {src.group(1)}")
            continue
        if "Reveal.initialize" in body:
            # Every deck bundles its init together with extra code (the
            # fragmentshown → playAnimation hook, the matrix canvas). The init
            # is replaced by the exporter, but the rest would vanish silently.
            rest = re.sub(r"Reveal\.initialize\(\{.*?\}\);", "", body, flags=re.S)
            rest = "\n".join(l for l in rest.splitlines()
                             if l.strip() and not l.strip().startswith("//"))
            if rest.strip():
                print(f"    dropped alongside Reveal.initialize "
                      f"({len(rest)} chars) — re-add in the exporter shell if needed:")
                for line in rest.splitlines()[:6]:
                    print(f"      {line.strip()[:72]}")
            continue
        first = next((l.strip() for l in body.splitlines() if l.strip()), "")
        print(f"    dropped inline script ({len(body)} chars): {first[:60]}…")

    for m in re.finditer(r"<script\b([^>]*)>", slides):
        attrs = m.group(1)
        if "type=" in attrs and "py" in attrs:
            continue  # PyScript content — kept on purpose
        print(f"    NOTE: inline script kept inside slides:{attrs[:60]}")


# ------------------------------------------------------------------- assets

class AssetCopier:
    """Copies deck assets into classes/<class>/assets/, de-duplicating names.

    Three source image dirs feed these decks, so a bare basename can collide.
    On a collision with *different* bytes the parent directory name is prefixed
    rather than silently overwriting.
    """

    def __init__(self, assets_dir: Path, max_width: int):
        self.dir = assets_dir
        self.max_width = max_width
        self.taken: dict[str, Path] = {}  # out name -> source path
        self.copied = 0
        self.shrunk = 0

    def add(self, src: Path) -> str:
        for name, known in self.taken.items():
            if known == src:
                return name
        stem = src.stem
        if any(n for n, k in self.taken.items() if Path(n).stem == stem and k != src):
            stem = f"{src.parent.name}_{stem}"
            print(f"    name collision on {src.name} → {stem}{src.suffix}")
        self.dir.mkdir(parents=True, exist_ok=True)
        name = self._optimize(src, stem)
        self.taken[name] = src
        self.copied += 1
        return name

    def _optimize(self, src: Path, stem: str) -> str:
        """Write src into the assets dir, re-encoding when that pays off.

        The source decks store screenshots as 1–2 MB PNGs. Resizing them and
        saving as PNG again barely helps (a 1600px photographic PNG is still
        1.7 MB), so pick the container by content: JPEG for opaque images, WebP
        when there's an alpha channel to keep. Animated GIFs and SVGs are left
        untouched — re-encoding would drop the animation.
        """
        original = self.dir / f"{stem}{src.suffix}"
        if src.suffix.lower() not in RASTER_EXT:
            shutil.copy2(src, original)
            return original.name
        try:
            from PIL import Image
        except ImportError:
            shutil.copy2(src, original)
            return original.name

        try:
            with Image.open(src) as im:
                im.load()
                resized = False
                if max(im.size) > self.max_width:
                    ratio = self.max_width / max(im.size)
                    im = im.resize(
                        (max(1, round(im.width * ratio)), max(1, round(im.height * ratio))),
                        Image.LANCZOS,
                    )
                    resized = True

                has_alpha = im.mode in ("RGBA", "LA") or (
                    im.mode == "P" and "transparency" in im.info
                )
                if has_alpha:
                    cand = self.dir / f"{stem}.webp"
                    im.convert("RGBA").save(cand, "WEBP", quality=85, method=6)
                else:
                    cand = self.dir / f"{stem}.jpg"
                    im.convert("RGB").save(cand, "JPEG", quality=82,
                                           optimize=True, progressive=True)
        except Exception as e:  # corrupt or exotic image — keep the original
            print(f"    could not re-encode {src.name} ({e}); copying original")
            shutil.copy2(src, original)
            return original.name

        # Only keep the re-encode if it actually helps; a small flat PNG often
        # beats JPEG, and swapping it would trade size for artefacts.
        if cand.stat().st_size < src.stat().st_size * 0.75:
            if resized:
                self.shrunk += 1
            return cand.name
        cand.unlink()
        shutil.copy2(src, original)
        return original.name


def rewrite_assets(slides: str, deck_dir: Path, copier: AssetCopier, deck: str) -> str:
    """Point every deck-owned image/config reference at assets/<name>."""

    def is_local(val: str) -> bool:
        return not (val.startswith(("http://", "https://", "//", "data:", "assets/"))
                    or val.startswith(VENDOR_PREFIXES))

    def sub_attr(match: re.Match[str]) -> str:
        attr, val = match.group(1), match.group(2)
        if not is_local(val) or Path(val).suffix.lower() not in IMAGE_EXT:
            return match.group(0)
        src = (deck_dir / val).resolve()
        if not src.is_file():
            print(f"    MISSING image, left as-is: {val}")
            return match.group(0)
        return f'{attr}="assets/{copier.add(src)}"'

    slides = re.sub(r'\b(src|data-background-image|poster)="([^"]+)"', sub_attr, slides)
    return rewrite_py_configs(slides, deck_dir, copier, deck)


def rewrite_py_configs(slides: str, deck_dir: Path, copier: AssetCopier, deck: str) -> str:
    """Copy PyScript `config="x.toml"` files plus any data files they declare."""

    def sub_config(match: re.Match[str]) -> str:
        val = match.group(1)
        if not val.endswith(".toml"):
            return match.group(0)
        src = (deck_dir / val).resolve()
        if not src.is_file():
            print(f"    MISSING pyscript config, left as-is: {val}")
            return match.group(0)
        return f'config="assets/{add_toml(src, deck_dir, copier)}"'

    return re.sub(r'config="([^"]+)"', sub_config, slides)


def add_toml(src: Path, deck_dir: Path, copier: AssetCopier) -> str:
    """Copy a pyscript toml, pointing its [files] at the copies beside it.

    PyScript resolves a `[files]` key against the **config file's own URL**, not
    the page's. The toml itself is copied into assets/, so the key has to be a
    bare filename: an "assets/x.csv" key would be fetched as assets/assets/x.csv,
    and PyScript mounts the 404 as an empty file — the slide then shows empty
    data instead of an error.
    """
    text = src.read_text(encoding="utf-8")
    try:
        files = tomllib.loads(text).get("files", {})
    except tomllib.TOMLDecodeError as e:
        print(f"    unparsable toml {src.name} ({e}); copied verbatim")
        files = {}
    for path in files:
        data = (deck_dir / path).resolve()
        if not data.is_file():
            print(f"    MISSING pyscript data file: {path}")
            continue
        text = text.replace(f'"{path}"', f'"{copier.add(data)}"')
    name = src.name
    (copier.dir).mkdir(parents=True, exist_ok=True)
    (copier.dir / name).write_text(text, encoding="utf-8")
    copier.taken.setdefault(name, src)
    return name


# --------------------------------------------------------------------- import

def import_deck(src_html: Path, class_slug: str, max_width: int) -> None:
    deck = src_html.stem
    html = src_html.read_text(encoding="utf-8")
    print(f"  {deck} … ")

    slides = extract_slides(html, deck)
    styles = extract_styles(html, slides)
    report_dropped_scripts(html, slides, deck)

    class_dir = CLASSES / class_slug
    copier = AssetCopier(class_dir / "assets", max_width)
    slides = rewrite_assets(slides, src_html.parent, copier, deck)

    title_m = re.search(r"<title>(.*?)</title>", html, re.S)
    title = title_m.group(1).strip() if title_m else deck

    parts = [
        f"<!-- imported from {src_html} by tools/import_decks.py -->",
        f"<!-- title: {title} -->",
    ]
    if styles:
        parts.append(f"<style>\n{styles}\n</style>")
    parts.append(slides)

    out = class_dir / "decks" / f"{deck}.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(parts) + "\n", encoding="utf-8")

    n_slides = len(re.findall(r"<section\b", slides))
    n_py = len(re.findall(r'<script\s+type="py', slides))
    print(f"    → {out.relative_to(ROOT)}  "
          f"({n_slides} sections, {n_py} py blocks, "
          f"{copier.copied} assets, {copier.shrunk} downscaled)")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", type=Path, default=DEFAULT_SRC,
                    help=f"directory holding the source decks (default: {DEFAULT_SRC})")
    ap.add_argument("--class", dest="class_slug", required=True,
                    help="target class slug under classes/")
    ap.add_argument("--deck", required=True,
                    help='deck stem, or "all" for every .html in --src')
    ap.add_argument("--max-width", type=int, default=1600,
                    help="downscale raster images wider than this (default: 1600)")
    args = ap.parse_args()

    if not args.src.is_dir():
        print(f"source directory not found: {args.src}", file=sys.stderr)
        return 1

    if args.deck == "all":
        decks = sorted(args.src.glob("*.html"))
    else:
        one = args.src / f"{args.deck}.html"
        if not one.is_file():
            print(f"deck not found: {one}", file=sys.stderr)
            return 1
        decks = [one]

    print(f"Importing {len(decks)} deck(s) into classes/{args.class_slug}/ …")
    for d in decks:
        import_deck(d, args.class_slug, args.max_width)
    print("Done. Review the fragments, then run `python export_decks.py`.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
