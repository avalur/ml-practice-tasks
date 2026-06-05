# ML-LeetCode website — implementation plan

> Status: **planning / not yet implemented.** This document is the shared
> reference for the web app. Work happens on the `feat/web-app` branch, landing
> via PR to `master`. We start with a **Pyodide runner spike** (Phase 0a) to
> de-risk the core before any app scaffolding.
>
> This revision incorporates a Codex (GPT-5.5) second-opinion review of the
> original plan; the notable changes from that review are marked _[codex]_.

## Context

This repo is a "LeetCode for ML": small Python ML tasks that students solve **by
hand** and verify with `pytest` (see the root `README.md`). The goal is a polished
LeetCode-style web app that serves these tasks, runs the student's code **in the
browser** (Pyodide/WASM — no server-side sandbox), and tracks per-user progress
behind OAuth login.

**Confirmed decisions:**

- **Execution:** in-browser via **Pyodide/WASM**. `numpy` and `pytest` are both
  bundled Pyodide packages, loaded with `pyodide.loadPackage([...])`; the real
  test suite runs client-side. No server executes untrusted code.
- **Stack:** **Next.js** (App Router, TypeScript) + **Postgres**, as a monorepo —
  the site lives in `web/` inside this repo and reads `problems/` as the content
  source of truth.
- **Auth:** **Auth.js (NextAuth v5)** — GitHub + Google first, then LinkedIn +
  JetBrains once their OIDC contracts are confirmed.
- **Generated web content is committed** to the repo (not a build artifact), so
  Vercel never runs Python — it only builds Next.js. _[codex]_
- All repo artifacts stay in **English**.

**Core invariant that drives the design:** every problem's `test.py` does
`from tools.checks import assert_clean` and uses the fixtures `impl` /
`impl_source` / `banned` / `rng_for` from `conftest.py`, with `pytest.ini` setting
`pythonpath = .`. The Pyodide filesystem must reproduce that import topology
exactly, or the tests won't even collect. `problems/` remains the single source of
truth — the web app never forks task content.

**Trust caveat:** verdicts are computed client-side, so a determined user could
spoof "solved". Accepted for a learning tool — but the data model separates
`clientStatus` from `verifiedStatus` **from day one**, so progress is explicitly
"client-solved" until a future server-side re-verification pass exists. _[codex]_

---

## Monorepo layout

```
ml-practice-tasks/
  problems/ tasks/ conftest.py pytest.ini   # unchanged Python content
  tools/                                     # banned-construct checks (shipped to Pyodide)
  content_pipeline.py          # NEW: single shared model (typed ProblemBundle) [codex]
  generate.py                  # thin target over content_pipeline (tasks/ stubs)
  export_web.py                # thin target over content_pipeline (web content)
  spikes/pyodide-runner/       # NEW: throwaway de-risking spike (Phase 0a)
  web/                         # NEW: Next.js app (pnpm)
    public/content/            # generated bundles + manifest.json — COMMITTED [codex]
    public/pyodide/            # self-hosted, version-pinned Pyodide runtime
    src/...
  .github/workflows/ci.yml     # extended: python job + web job
```

- Package manager: **pnpm**, single package in `web/`.
- `web/public/content/` is **committed**; CI runs `python export_web.py --check`
  to guarantee it matches `problems/`. Vercel consumes it as-is.

---

## Single content pipeline _[codex]_

Originally `generate.py` and `export_web.py` were separate generators — two things
to keep in sync with `problems/`. Instead, extract **`content_pipeline.py`** as the
one source of logic:

- A typed **`ProblemBundle`** model (topic, slug, title, difficulty, entry, banned,
  statement, stub source, test source, meta source, contentHash, pyDeps,
  `web_runnable`).
- It owns today's `generate.py` helpers (`load_meta`, `make_stub`, `render_readme`,
  `build`) plus **`META` schema validation** (meta.py is executed Python, so guard
  required keys/types). _[codex]_
- `generate.py` (student `tasks/` stubs) and `export_web.py` (web bundles +
  manifest) become thin targets over it, each with a `--check` mode.

### `export_web.py` output

For each `web_runnable` problem, the **runtime bundle = exactly what Pyodide needs
to run pytest**:

```
web/public/content/problems/<topic>/<slug>/
  submission.py   # stub via make_stub (reference body stripped — solution never exported)
  test.py         # verbatim
  meta.py         # verbatim (conftest's `banned` fixture executes meta.py)
  meta.json       # parsed META, so Next.js reads it without running Python
  readme.md       # via render_readme
web/public/content/_shared/
  conftest.py  tools/__init__.py  tools/checks.py  pytest.ini
web/public/content/manifest.json
```

The on-disk layout mirrors the repo (`problems/<topic>/<slug>`) so the Pyodide FS
can reproduce local semantics exactly. _[codex]_

`manifest.json` shape:

```json
{
  "topics": ["numpy_basics"],
  "difficulties": ["easy", "medium", "hard"],
  "pyodideVersion": "0.x.y",
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
      "bundlePath": "/content/problems/numpy_basics/pairwise_distances",
      "pyDeps": ["numpy"],
      "webRunnable": true,
      "contentHash": "<sha256>"
    }
  ]
}
```

`pyDeps` + `webRunnable` are the **author-facing "web-compatible problem"
contract** _[codex]_: a task needing packages Pyodide can't provide (e.g. torch)
declares `web_runnable: false` and is shown but not solvable in-browser yet.

---

## Phase 0a — Pyodide runner spike (do this FIRST) _[codex]_

The single biggest risk is Pyodide runner reliability + UX, not Next.js. Prove it
with a throwaway spike in `spikes/pyodide-runner/` **before** building the app:

- **Step 1 (Node):** a `pyodide` (Node) script that loads `numpy` + `pytest` via
  `loadPackage`, writes the real `pairwise_distances` files into a `/task` FS,
  `chdir`s there, runs `pytest.main([...])` for the problem, and captures
  structured results. Run it **repeatedly in one interpreter** alternating:
  correct solution, failing solution, syntax error, banned `for`-loop, and
  `while True: pass`. **Assert no state leakage** between runs.
- **Step 2 (browser):** a minimal static page + Web Worker doing the same, to
  measure real first-load weight and per-run latency, and to validate
  **timeout-by-worker-termination**.

### Runner mechanics (validated by the spike, reused by the app)

- Load self-hosted pinned Pyodide; `loadPackage(pyDeps ∪ {"pytest"})` **once**,
  then reuse. (Keep `micropip` only for future non-bundled `pyDeps`.) _[codex]_
- Per Run, **recreate** the FS and `chdir` to `/task` (this is what satisfies
  `pythonpath = .`):

  ```
  /task/conftest.py  /task/pytest.ini
  /task/tools/__init__.py  /task/tools/checks.py
  /task/problems/<topic>/<slug>/{submission.py (USER CODE), test.py, meta.py}
  ```

- Run via a **custom pytest plugin** capturing `pytest_runtest_logreport` (not
  stdout parsing): `pytest.main(["-q","-p","no:cacheprovider","/task/problems/<topic>/<slug>"])`
  → structured `{nodeid, outcome, longreprtext, durationMs}`.
- **Purge every module whose `__file__` is under `/task`** (test modules,
  `conftest`, `impl_*`, `meta_*`) and `importlib.invalidate_caches()` between runs,
  then rebuild the tree — `impl_*`/`meta_*` alone is not enough. _[codex]_
- **No threads / multiprocessing** in Pyodide → run serially, no `xdist`.
- **Infinite loops can't be interrupted in WASM** → a UI watchdog (~15 s)
  terminates the worker, reports `TIMEOUT`, respawns a fresh one. (A
  `SharedArrayBuffer` interrupt is possible later but needs COOP/COEP headers.)
  A watchdog does **not** stop memory blowups — note as a known limit. _[codex]_
- **Run IDs + stale-result suppression:** tag each run; a slow/terminated run's
  result must never apply to a newer submission. Add respawn telemetry. _[codex]_
- Optionally run `find_violations` JS-side for a live lint preview (the real
  `test_no_banned_constructs` still enforces it).

Typed worker message protocol — in: `INIT` / `RUN { runId, code, bundlePath, pyDeps }`;
out: `READY` / `PROGRESS` / `RESULT { runId, passed, total, verdict, tests[], durationMs }`
/ `TIMEOUT { runId }` / `WORKER_ERROR`.

**Spike success criteria / latency budgets** _[codex]_: editor usable render,
runner-ready after warm start, first-run latency, warm-rerun latency, timeout
respawn latency — all acceptable on slow network + mobile, or Phase 0 is not
shippable.

---

## Phase 0b — Pipeline + browse + solve (no auth/DB)

Once the spike is green, build the shippable no-login site.

### Frontend

- `/problems` — manifest-driven list with client-side filters (topic, difficulty,
  later solved-status).
- `/problems/[topic]/[slug]` — SSR statement + constraint chips, code editor, Run
  button, results panel.
- **Editor: CodeMirror 6** (not Monaco) — the page is already heavy from the
  Pyodide WASM payload; CM6 is far smaller and spawns no competing worker. Add
  **localStorage autosave** so no-auth users don't lose code. _[codex]_
- A `usePyodideRunner()` hook owns the singleton worker and exposes `run(code)` +
  `status`.

### CI

Extend `.github/workflows/ci.yml`: the Python job also runs
`python generate.py --check` and `python export_web.py --check`; a new `web` job
(`needs: python`) runs `pnpm install` → `pnpm lint` → `pnpm build`, plus a
**Playwright Pyodide smoke test** that loads a problem and runs a known solution.
Track a **browser/perf matrix**. _[codex]_

---

## Phase 1 — Auth (Auth.js v5), split by provider risk _[codex]_

- `web/src/auth.ts` + `app/api/auth/[...nextauth]/route.ts`, `@auth/prisma-adapter`,
  **database session strategy**. Keep auth + submission APIs **Node runtime only**
  (Prisma adapter isn't edge-safe). _[codex]_
- **Phase 1a:** GitHub + Google (routine, built-in).
- **Phase 1b:** LinkedIn (OIDC: requires `openid profile email`, the OIDC product
  provisioned, and email may be absent) + **JetBrains Hub OIDC** (issuer discovery
  + explicit endpoints; confirm the actual provider contract before coding — not a
  vague "JetBrains account"). _[codex]_
- Env: `AUTH_SECRET`, `AUTH_URL`, `AUTH_GITHUB_ID/SECRET`, `AUTH_GOOGLE_ID/SECRET`,
  `AUTH_LINKEDIN_ID/SECRET`, `AUTH_JETBRAINS_ID/SECRET`, `AUTH_JETBRAINS_ISSUER`.

---

## Phase 2 — Persistence & progress (Prisma + Postgres)

**ORM: Prisma.** Schema:

- Auth.js models: `User`, `Account`, `Session`, `VerificationToken`.
- `Problem` — `id = "topic/slug"`, `topic`, `slug`, `title`, `difficulty`,
  `contentHash`.
- `Submission` — `userId`, `problemId`, `code`, `clientStatus`, `verifiedStatus`,
  `passed`, `total`, plus _[codex]_ `contentHash`, `runnerVersion`,
  `pyodideVersion`, `durationMs`, `errorKind`, `createdAt` (indexed).
- `UserProblemProgress` — `@@unique([userId, problemId])`, with _[codex]_
  `clientSolved`/`verifiedSolved`, `attemptCount`, `bestPassed`, `bestTotal`,
  `lastSubmittedAt`, `solvedAt`, `bestSubmissionId`.

**manifest → `Problem` sync is an explicit, environment-gated release/CI step**
(`db:sync-problems`) — never a side effect of ordinary (preview) builds. _[codex]_
`/api/submissions` persists a run; `/problems` shows solved badges; `/profile`
shows solved count + recent submissions. Add **rate limits + submission size
limits**, and **privacy wording** for stored code. _[codex]_

---

## Phase 3 — Polish

Leaderboard, submission history, optional **server-side re-verification** of stored
submissions (flips `verifiedStatus`), streaks. Note: leaderboards/certificates make
the client-trust caveat material — gate them on `verifiedStatus`.

---

## Deployment (Vercel + Neon)

- Vercel Root Directory = `web`; build = `pnpm prisma generate && pnpm build`.
  **No Python in the Vercel build** — content is committed and CI-checked. _[codex]_
- Postgres: **Neon** — a pooled `DATABASE_URL` + a `DIRECT_URL` for migrations;
  run `prisma migrate deploy` and `db:sync-problems` as gated release steps.
- Pyodide self-hosted under `public/pyodide/` with immutable cache headers; set
  **CSP**, and **COOP/COEP** if/when enabling `SharedArrayBuffer` interrupts.

---

## Reuse from the existing repo

- `generate.py` helpers (`load_meta`, `make_stub`, `render_readme`, `build`) →
  migrate into `content_pipeline.py`.
- `conftest.py` + `tools/checks.py` — shipped verbatim into every Pyodide bundle.
- `pytest.ini` semantics (`pythonpath = .`) — reproduced via `chdir('/task')`.

## Verification

- `python generate.py --check` + `python export_web.py --check` → no drift;
  `pytest problems` → still green.
- Spike: repeated runs in one interpreter stay correct (a failing-then-passing
  solution must not reuse stale imports); `while True: pass` → `TIMEOUT` + respawn.
- `cd web && pnpm dev`: open `pairwise_distances`, correct solution → all pass;
  `for`-loop → `test_no_banned_constructs` fails; results render structured.
- Phase 1+: sign in per provider; session persists. Phase 2+: solving marks the
  problem client-solved; `/profile` reflects it after reload.

## Top risks / open questions

- **Biggest risk:** Pyodide runner reliability + UX (cold-start weight, repeated
  `pytest.main()` state leakage, timeout recovery, browser compatibility). De-risk
  in Phase 0a before anything else. _[codex]_
- JetBrains/LinkedIn OIDC contracts need confirmation before Phase 1b.
- Committed generated content needs the `--check` gate to never drift.
- Client-trusted verdicts (documented; `verifiedStatus` + Phase 3 is the hedge).
