# Plan — Marimo Homework: interactive WASM notebooks in the browser

## Context
Youth-ai-club assignments (`~/PycharmProjects/youth-ai-club`) currently live as
JetBrains EduTools stubs + pytest. The goal is to convert them to **marimo reactive
notebooks** and serve them interactively in the browser via WASM (Pyodide), at zero
additional infrastructure cost (Vercel static hosting).

**Phase 1 scope:** 10 NumPy-only assignments — GradientDescent (7) + SimpleNeuralNetwork (3).  
PyTorch assignments (26) are deferred (Phase 2, separate infra).

**Why marimo over Jupyter:** reactive — changing a cell auto-reruns dependents, so a
student's fix immediately triggers the checker cell. Git-friendly (.py files). Can
export to self-contained WASM HTML with no backend.

---

## Key constraints

- Vercel can only serve static files → must export marimo to self-hosted WASM HTML
- `marimo export html-wasm notebook.py -o dir/` → HTML + assets, Pyodide from CDN
- The exported HTML is a few hundred KB; Pyodide (~30 MB) is loaded from CDN at runtime
- Marimo WASM needs `--mode edit` for educational use (student sees + edits code cells)
- PyTorch is NOT available in Pyodide → Phase 2

---

## Directory layout

```
ml-practice-tasks/
├── notebooks/                      ← NEW: marimo .py notebooks per assignment
│   ├── manifest.json               ← metadata (title, slug, difficulty, section)
│   ├── gradient_descent/
│   │   ├── intro.py
│   │   ├── linear_regression.py
│   │   ├── full_gd.py
│   │   ├── stochastic_gd.py
│   │   ├── momentum.py
│   │   ├── adagrad.py
│   │   └── regularization.py
│   └── simple_neural_network/
│       ├── intro.py
│       ├── forward.py
│       └── backpropagation.py
├── export_notebooks.py             ← NEW: like export_web.py, generates web/public/homework/
└── web/
    ├── public/
    │   └── homework/               ← GENERATED + COMMITTED (same pattern as web/public/content/)
    │       ├── gradient_descent/
    │       │   ├── intro/
    │       │   │   ├── index.html
    │       │   │   └── assets/
    │       │   └── linear_regression/
    │       │       ├── index.html
    │       │       └── assets/
    │       └── simple_neural_network/
    │           └── ...
    └── src/app/
        └── homework/
            ├── page.tsx            ← listing page
            └── [section]/
                └── [slug]/
                    └── page.tsx    ← iframe wrapper
```

---

## Notebook authoring pattern

Each marimo notebook is a plain Python file:

```python
# /// script
# dependencies = ["numpy", "marimo"]
# ///

import marimo as mo
import numpy as np

app = mo.App(width="medium")

@app.cell
def _intro():
    mo.md("""
    ## Gradient Descent: Linear Regression

    Implement `gradient_step(X, y, w, lr)` that performs one step of gradient
    descent for linear regression and returns the updated weights vector.
    """)


@app.cell
def _student_code(np):
    # ─── Your implementation ──────────────────────────────────────────────────
    def gradient_step(X, y, w, lr):
        raise NotImplementedError("Your code here")
    # ─────────────────────────────────────────────────────────────────────────
    return gradient_step,


@app.cell
def _checks(gradient_step, mo, np):
    """Oracle tests — this cell reruns automatically when you edit the cell above."""
    X = np.array([[1.0, 2.0], [3.0, 4.0], [5.0, 1.0]])
    y = np.array([5.0, 11.0, 6.0])
    w = np.zeros(2)

    try:
        w_new = gradient_step(X, y, w, 0.01)
        assert w_new.shape == (2,), f"shape should be (2,), got {w_new.shape}"
        expected = np.array([-0.84, -0.68])
        assert np.allclose(w_new, expected, atol=1e-3), \
            f"expected {expected}, got {w_new}"
        mo.callout(mo.md("✅ All tests passed!"), kind="success")
    except NotImplementedError:
        mo.callout(mo.md("✏️ Implement `gradient_step` in the cell above"), kind="neutral")
    except Exception as e:
        mo.callout(mo.md(f"❌ {e}"), kind="danger")


if __name__ == "__main__":
    app.run()
```

**Key marimo properties used:**
- `mo.md(...)` — Markdown with LaTeX rendering
- `mo.callout(...)` — coloured callout boxes (success / danger / neutral)
- Cell parameters `(gradient_step, mo, np)` — declare reactive dependencies
- Cells auto-rerun when their dependencies change

---

## `manifest.json` format

```json
{
  "sections": [
    {
      "slug": "gradient_descent",
      "title": "Gradient Descent",
      "order": 1,
      "notebooks": [
        { "slug": "intro",            "title": "Intro",                  "difficulty": "easy"   },
        { "slug": "linear_regression","title": "Linear Regression",      "difficulty": "easy"   },
        { "slug": "full_gd",          "title": "Full Gradient Descent",  "difficulty": "easy"   },
        { "slug": "stochastic_gd",    "title": "Stochastic GD",         "difficulty": "medium" },
        { "slug": "momentum",         "title": "Momentum",               "difficulty": "medium" },
        { "slug": "adagrad",          "title": "Adagrad",                "difficulty": "medium" },
        { "slug": "regularization",   "title": "Regularization",         "difficulty": "medium" }
      ]
    },
    {
      "slug": "simple_neural_network",
      "title": "Simple Neural Network",
      "order": 2,
      "notebooks": [
        { "slug": "intro",           "title": "Intro",           "difficulty": "medium" },
        { "slug": "forward",         "title": "Forward Pass",    "difficulty": "medium" },
        { "slug": "backpropagation", "title": "Backpropagation", "difficulty": "hard"   }
      ]
    }
  ]
}
```

---

## `export_notebooks.py` (new script)

Mirrors `export_web.py` in structure:

```python
#!/usr/bin/env python3
"""Export marimo notebooks to WASM HTML bundles.

Usage:
  python export_notebooks.py          # regenerate web/public/homework/
  python export_notebooks.py --check  # verify no drift (exit 1 if stale)
"""
import argparse, hashlib, json, subprocess, sys
from pathlib import Path

ROOT      = Path(__file__).parent
NOTEBOOKS = ROOT / "notebooks"
HOMEWORK  = ROOT / "web" / "public" / "homework"

def export_one(src: Path, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["marimo", "export", "html-wasm", str(src),
         "-o", str(out_dir), "--mode", "edit"],
        check=True,
    )

def notebook_hash(src: Path) -> str:
    return hashlib.sha256(src.read_bytes()).hexdigest()[:16]

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    manifest = json.loads((NOTEBOOKS / "manifest.json").read_text())
    drift = []

    for section in manifest["sections"]:
        sec = section["slug"]
        for nb in section["notebooks"]:
            slug = nb["slug"]
            src  = NOTEBOOKS / sec / f"{slug}.py"
            out  = HOMEWORK / sec / slug
            html = out / "index.html"

            if args.check:
                # A stale export: index.html missing or older than source
                if not html.exists():
                    drift.append(f"missing: {html.relative_to(ROOT)}")
                    continue
                # Marimo embeds the source hash in the HTML; check it
                content = html.read_text()
                h = notebook_hash(src)
                if h not in content:
                    drift.append(f"stale: {html.relative_to(ROOT)}")
            else:
                export_one(src, out)
                print(f"  exported {sec}/{slug}")

    if args.check:
        if drift:
            print("Homework exports are out of date; run `python export_notebooks.py`:")
            for d in drift: print(f"  {d}")
            return 1
        print(f"Homework exports are up to date.")
        return 0
    print(f"Done.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

**CI addition** in `.github/workflows/ci.yml`:
```yaml
- name: Install marimo
  run: pip install marimo
- name: Check homework exports
  run: python export_notebooks.py --check
```

---

## Next.js pages

### `/homework` — listing

```tsx
// web/src/app/homework/page.tsx (Server Component)
import manifest from "../../../../notebooks/manifest.json";

export default function HomeworkPage() {
  return (
    <article>
      <h1>Homework</h1>
      <p className="muted">Interactive marimo notebooks — edit code, see results live.</p>
      {manifest.sections.map(section => (
        <section key={section.slug}>
          <h2>{section.title}</h2>
          <ul className="problem-list">
            {section.notebooks.map(nb => (
              <li key={nb.slug}>
                <Link
                  href={`/homework/${section.slug}/${nb.slug}`}
                  className="problem-card"
                >
                  <span className="title">{nb.title}</span>
                  <span className={`badge ${nb.difficulty}`}>{nb.difficulty}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
```

### `/homework/[section]/[slug]` — iframe wrapper

```tsx
// web/src/app/homework/[section]/[slug]/page.tsx (Static SSG)
import manifest from "../../../../../../notebooks/manifest.json";

export function generateStaticParams() {
  return manifest.sections.flatMap(s =>
    s.notebooks.map(nb => ({ section: s.slug, slug: nb.slug }))
  );
}

export default function NotebookPage({ params }) {
  const { section, slug } = params;
  const sec = manifest.sections.find(s => s.slug === section);
  const nb  = sec?.notebooks.find(n => n.slug === slug);

  return (
    <div className="homework-frame-wrapper">
      <iframe
        src={`/homework/${section}/${slug}/index.html`}
        title={nb?.title ?? slug}
        className="homework-frame"
      />
    </div>
  );
}
```

### CSS

```css
/* Full-height iframe, flush with viewport edges */
.homework-frame-wrapper {
  height: calc(100vh - 56px);   /* 56px = header height */
  margin: -1.5rem -2rem -2rem;  /* break out of .container padding */
}
.homework-frame {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}
```

---

## Navigation

Add `"Homework"` to the header nav in `web/src/app/layout.tsx`:
```tsx
<Link href="/homework">Homework</Link>
```

---

## Authoring workflow (per batch of notebooks)

1. Write `notebooks/[section]/[slug].py` (marimo format, see pattern above)
2. `python export_notebooks.py` — regenerate WASM HTML
3. `python export_notebooks.py --check` — verify no drift
4. Open the exported HTML locally to smoke-test interactivity
5. PR → CI checks → merge → Vercel auto-deploys

---

## Assets size analysis

| Component | Size | Notes |
|---|---|---|
| marimo WASM frontend | ~2–4 MB per notebook export | Deduplication possible |
| Pyodide runtime | ~30 MB | Loaded from CDN at runtime, **not committed** |
| Notebook source | ~5–20 KB | Embedded in index.html |
| NumPy wheel | ~4 MB | Loaded from Pyodide CDN |

**10 notebooks × ~3 MB = ~30 MB** of committed static files. Comparable to the pandas wheels we already committed (`web/public/pyodide/`). Acceptable.

**Optimisation if needed:** marimo supports a `--cdn` flag that loads all assets from CDN → committed HTML becomes < 50 KB each.

---

## Open questions / risks

| Risk | Mitigation |
|---|---|
| marimo WASM bundle changes between versions | Pin `marimo>=0.13,<0.14` in requirements.txt |
| Pyodide CDN outage | Acceptable for educational use; could self-host later |
| No progress tracking | Intentional for Phase 1; WASM is stateless |
| PyTorch needed | Phase 2: HuggingFace Spaces (free, GPU-capable) |
| Large repo size | Use `--cdn` flag if > 50 MB becomes a problem |

---

## Phase 2 notes (future)

For PyTorch assignments (PyTorchIntroduction, BackpropagationAndMLP, Transformers):
- Deploy `marimo run notebooks/pytorch/` on **HuggingFace Spaces** (free Docker environment)
- Embed via iframe on ml-practice-tasks site
- Alternatively: Fly.io / Railway for always-on server
