# ML-LeetCode website — implementation plan

> Status: **planning / not yet implemented.** This document is the shared
> reference for the web app. Implementation happens on the `feat/web-app`
> branch, Phase 0 first, landing via PR to `master`.

## Context

This repo is a "LeetCode for ML": small Python ML tasks that students solve **by
hand** and verify with `pytest` (see the root `README.md`). The goal is a polished
LeetCode-style web app that serves these tasks, runs the student's code **in the
browser** (Pyodide/WASM — no server-side sandbox), and tracks per-user progress
behind OAuth login.

**Confirmed decisions:**

- **Execution:** in-browser via **Pyodide/WASM**. `numpy` ships with Pyodide;
  `pytest` installs via `micropip`; `pytest.main([...])` runs the real test suite
  client-side. No server executes untrusted code.
- **Stack:** **Next.js** (App Router, TypeScript) + **Postgres**, as a monorepo —
  the site lives in `web/` inside this repo and reads `problems/` as the content
  source of truth.
- **Auth:** **Auth.js (NextAuth v5)** with **GitHub, Google, LinkedIn, JetBrains**.
- All repo artifacts stay in **English**.

**Core invariant that drives the design:** every problem's `test.py` does
`from tools.checks import assert_clean` and uses the fixtures `impl` /
`impl_source` / `banned` / `rng_for` from `conftest.py`, with `pytest.ini` setting
`pythonpath = .`. The Pyodide filesystem must reproduce that import topology
exactly, or the tests won't even collect. `problems/` remains the single source of
truth — the web app never forks task content.

**Trust caveat:** verdicts are computed client-side, so a determined user could
spoof "solved". This is acceptable for a learning tool. We store the submitted
code so a future server-side re-verification pass (CI batch or serverless) can
audit if ever needed.

---

## Monorepo layout

```
ml-practice-tasks/
  problems/ tasks/ tools/ conftest.py generate.py   # unchanged Python content
  export_web.py                # NEW: emit web content from problems/
  web/                         # NEW: Next.js app (pnpm)
    public/content/            # generated bundles + manifest.json (gitignored build artifact)
    public/pyodide/            # self-hosted, version-pinned Pyodide runtime
    src/...
  .github/workflows/ci.yml     # extended: python job + web job
```

- Package manager: **pnpm**, single package in `web/`.
- `web/public/content/` is a build artifact (gitignored); a CI `--check` guards
  drift, and Vercel regenerates it on every build.

---

## Phase 0 — Content pipeline + browsing + in-browser solving (no auth/DB)

Independently shippable: a working "solve in the browser" site with no login.

### `export_web.py` (root, reuses `generate.py`)

Reuse `generate.py`'s `build`, `make_stub`, `load_meta`, `render_readme`. Model it
as a pure `{path: bytes} + manifest` producer so `--check` is a byte-for-byte
compare, mirroring `generate.py --check`. For each problem it emits a **runtime
bundle = exactly what Pyodide needs to run pytest**:

```
web/public/content/<topic>/<slug>/
  submission.py   # stub via make_stub (reference body stripped — solution never exported)
  test.py         # verbatim
  meta.py         # verbatim (conftest's `banned` fixture executes meta.py)
  meta.json       # parsed META, so Next.js can read it without running Python
  readme.md       # via render_readme
web/public/content/_shared/
  conftest.py  tools/__init__.py  tools/checks.py  pytest.ini
web/public/content/manifest.json
```

`manifest.json` shape:

```json
{
  "topics": ["numpy_basics"],
  "difficulties": ["easy", "medium", "hard"],
  "problems": [
    {
      "id": "numpy_basics/pairwise_distances",
      "topic": "numpy_basics",
      "slug": "pairwise_distances",
      "title": "Pairwise Euclidean Distances",
      "difficulty": "easy",
      "entry": "pairwise_distances",
      "banned": { "modules": ["scipy", "sklearn"], "loops": true },
      "statementMd": "...",
      "bundlePath": "/content/numpy_basics/pairwise_distances",
      "pyDeps": ["numpy"],
      "contentHash": "<sha256>"
    }
  ]
}
```

`pyDeps` is per-problem so future tasks can declare extra Pyodide packages.

### Pyodide runner — `web/src/worker/pyodide.worker.ts`

A singleton interpreter in a Web Worker.

- Load self-hosted pinned Pyodide from `public/pyodide/`, `loadPackage(pyDeps)`,
  `micropip.install("pytest")` — **once**, then reuse. Warm it on problem-page mount.
- Per Run, build the FS and `chdir` to `/task` (this is what satisfies
  `pythonpath = .`):

  ```
  /task/conftest.py  /task/pytest.ini
  /task/tools/__init__.py  /task/tools/checks.py
  /task/<topic>/<slug>/{submission.py (USER CODE), test.py, meta.py}
  ```

- Run via a **custom pytest plugin** that captures results in
  `pytest_runtest_logreport` (not stdout parsing):
  `pytest.main(["-q", "-p", "no:cacheprovider", "/task/<topic>/<slug>"])`
  → structured `{nodeid, outcome, longreprtext, durationMs}` per test.
- **Purge `sys.modules`** (`impl_*`, `meta_*`) and call
  `importlib.invalidate_caches()` between runs, so resubmissions never test stale
  code.
- **No threads / multiprocessing** in Pyodide → run serially, no `xdist`.
- **Infinite loops can't be interrupted in WASM** → a UI watchdog (~15 s)
  terminates the worker, reports `TIMEOUT`, and respawns a fresh one.
- Optional: also run `find_violations` JS-side for a live banned-construct lint
  preview (the `test_no_banned_constructs` test still enforces it for real).

Typed message protocol — in: `INIT` / `RUN { code, bundlePath, pyDeps }`; out:
`READY` / `PROGRESS` / `RESULT { passed, total, verdict, tests[], durationMs }` /
`TIMEOUT` / `WORKER_ERROR`.

### Frontend

- `/problems` — manifest-driven list with client-side filters (topic, difficulty,
  later solved-status).
- `/problems/[topic]/[slug]` — SSR statement + constraint chips, code editor, Run
  button, results panel.
- **Editor: CodeMirror 6** (not Monaco). The page is already heavy from the Pyodide
  WASM payload; CM6 is far smaller, tree-shakeable, and spawns no competing worker.
  Monaco's IntelliSense buys nothing here without in-browser numpy type info.
- A `usePyodideRunner()` hook owns the singleton worker and exposes `run(code)` +
  `status`.

### CI

Extend `.github/workflows/ci.yml`: the existing Python job also runs
`python export_web.py --check`; a new `web` job (`needs: python`) runs
`pnpm install` → `python export_web.py` → `pnpm lint` → `pnpm build`.

---

## Phase 1 — Auth (Auth.js v5)

- `web/src/auth.ts` + `app/api/auth/[...nextauth]/route.ts`.
- Providers: GitHub + Google (built-in); LinkedIn (built-in OIDC, add a `profile()`
  override + scope `openid profile email`); **JetBrains** as a custom OIDC/OAuth
  provider object with `issuer` / explicit endpoints + a `profile()` mapping
  `sub` → `id`.
- `@auth/prisma-adapter`, **database session strategy**.
- Env: `AUTH_SECRET`, `AUTH_URL`, `AUTH_GITHUB_ID/SECRET`, `AUTH_GOOGLE_ID/SECRET`,
  `AUTH_LINKEDIN_ID/SECRET`, `AUTH_JETBRAINS_ID/SECRET`, `AUTH_JETBRAINS_ISSUER`.

---

## Phase 2 — Persistence & progress (Prisma + Postgres)

**ORM: Prisma** (first-party, stable `@auth/prisma-adapter`). Schema:

- Auth.js models: `User`, `Account`, `Session`, `VerificationToken`.
- `Problem` — `id = "topic/slug"`, `topic`, `slug`, `title`, `difficulty`,
  `contentHash` (to detect manifest drift). Upserted from `manifest.json` by a
  `db:sync-problems` script at deploy.
- `Submission` — `userId`, `problemId`, `code`, `status`, `passed`, `total`,
  `verifiedStatus` (for a future server re-check), `createdAt`.
- `UserProblemProgress` — denormalized solved status per (user, problem) for fast
  list rendering.

`/api/submissions` persists a run; `/problems` shows solved badges; `/profile`
shows solved count + recent submissions.

---

## Phase 3 — Polish

Leaderboard, submission history, optional **server-side re-verification** of stored
submissions, streaks.

---

## Deployment (Vercel + Neon)

- Vercel Root Directory = `web`. The build command runs the **Python export before
  `next build`**:
  `pip install -r ../requirements.txt && python ../export_web.py && pnpm prisma generate && pnpm build`.
  (`export_web.py` must stay pure-stdlib — current `meta.py` imports nothing heavy.)
- Postgres: **Neon** — a pooled `DATABASE_URL` + a `DIRECT_URL` for migrations;
  run `prisma migrate deploy` on release.
- Pyodide self-hosted under `public/pyodide/` with immutable cache headers; the CSP
  must allow `wasm-unsafe-eval` and a worker.

---

## Files to create (representative)

- `export_web.py` (reuses `generate.py` helpers)
- `web/` Next.js app: `src/auth.ts`, `src/app/problems/...`,
  `src/worker/pyodide.worker.ts`, `src/hooks/usePyodideRunner.ts`,
  `prisma/schema.prisma`
- extend `.github/workflows/ci.yml`; extend root `.gitignore`
  (`web/public/content`, `web/node_modules`, `.next`)

## Reuse from the existing repo

- `generate.py`: `build`, `make_stub`, `load_meta`, `render_readme`
- `conftest.py` + `tools/checks.py` — shipped verbatim into every Pyodide bundle
- `pytest.ini` semantics (`pythonpath = .`) — reproduced via `chdir('/task')`

## Verification

- `python export_web.py && python export_web.py --check` → clean, no drift.
- `python generate.py --check` + `pytest problems` → still green (root unaffected).
- `cd web && pnpm dev`: open `pairwise_distances`, paste a correct solution → all
  tests pass; paste a `for`-loop solution → `test_no_banned_constructs` fails;
  paste `while True: pass` → watchdog `TIMEOUT`, worker respawns.
- Phase 1+: sign in with each provider; session persists.
- Phase 2+: solving marks the problem solved; `/profile` reflects it after reload.

## Top risks / open questions

- JetBrains OIDC specifics (issuer / scopes / endpoints) need confirmation from
  their developer console; LinkedIn OIDC scope + product-review quirks.
- Pyodide first-load weight (mitigate: self-host + immutable cache + warm on mount).
- Module-cache bleed between runs — must purge `sys.modules`.
- Double drift surface: both `generate.py --check` and `export_web.py --check`
  stay in CI.
- Client-trusted verdicts (documented; Phase 3 server re-verification is the hedge).
