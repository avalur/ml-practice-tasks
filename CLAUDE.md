# CLAUDE.md

Working notes for Claude Code in this repo. Read this first; it encodes the
conventions and the exact recipe for adding tasks so I don't re-derive them.

## What this repo is

"LeetCode for ML": many small Python ML tasks that students solve **by hand**
(no AI, no ready-made helpers) and verify with pytest. Companion to the course
at https://avalur.github.io/mlcourse. Author/owner: Alexander Avdiushenko
(`avalur`). He chats in Russian but **all repo artifacts are in English**, and
he likes to brainstorm design tradeoffs before I build.

There are now **two task families** (the sidebar groups by the `topic` prefix
before `_`):
- **`numpy_*`** — the original ML/numpy track.
- **`py_*`** — Python fundamentals (binary search, comprehensions, decorators,
  generators, OOP), **re-authored** (our own solutions, English statements,
  independent oracles) from the manytask course
  `gitlab.manytask.org/python/public-2025-fall` — credit it; never copy verbatim.
  Pure-Python tasks set `py_deps: []` in `meta.py` so Pyodide skips numpy, and
  use stdlib `random` (fixed seed) in tests rather than the numpy `rng_for`
  fixture. Where the source bundles several functions with *different*
  per-function bans (our `banned` is file-level), distill to the single by-hand
  variant.

## Architecture (don't break these invariants)

- **Source of truth = `problems/<topic>/<slug>/`.** Never hand-edit `tasks/`.
  - `reference.py` — working solution. The body between
    `# --- solution: begin ---` and `# --- solution: end ---` is stripped to
    make the student stub. Everything else (imports, signature, docstring) is
    kept verbatim, so put the full problem context in the docstring.
  - `test.py` — pytest. Runs against BOTH trees via the `impl` fixture, so it
    must not assume which file backs the implementation.
  - `meta.py` — a `META` dict: required `title`, `topic`, `difficulty`
    (easy/medium/hard), `entry`, `statement`; optional `banned`, `hints`,
    `order` (within-topic sort, default 100), `py_deps` (default `["numpy"]`;
    `[]` for pure-Python), `hidden`.
- **`tasks/<topic>/<slug>/` is generated** by `generate.py` (submission stub +
  copied test.py/meta.py + rendered README.md). Regenerate after any edit.
- **Constraints are enforced statically** by `tools/checks.py` via `ast`.
  `banned` keys: `modules` (import roots, e.g. `scipy`, `sklearn`), `names`
  (identifiers/attrs, e.g. `cdist`, `norm` — also covers builtins like
  `sum`/`set`/`sorted`/`reversed`), `loops` (truthy → no `for`/`while`),
  `operators` (subset of `{"in", "not in"}` — membership), `slicing` (truthy →
  no `seq[a:b]`; plain indexing `seq[i]` is still fine). The
  `assert_clean(impl_source, banned)` check only inspects the student's source —
  test code is trusted, so loops/banned builtins in a reference oracle are fine.

## Fixtures available in test.py (from `conftest.py`)

- `impl` — the loaded implementation module; call `impl.<entry>(...)`.
- `impl_source` — its source text (pass to `assert_clean`).
- `banned` — the `banned` dict from meta.py.
- `rng_for` — factory: `rng = rng_for(seed)` → seeded `np.random.default_rng`.
  Always seed randomness so tests are deterministic.

## Recipe: add a new task

1. `mkdir -p problems/<topic>/<slug>` and create `reference.py`, `test.py`,
   `meta.py` (copy `problems/numpy_basics/pairwise_distances/` as the template).
2. In `reference.py`: full docstring (it survives into the stub), real solution
   wrapped in the `# --- solution: begin/end ---` markers.
3. In `test.py`: a trusted oracle (brute force is fine here) + parametrized
   seeds via `rng_for`, plus a `test_no_banned_constructs(impl_source, banned)`.
4. In `meta.py`: fill `META`, especially `banned` for the concept being taught
   (ban the shortcut that would trivialize it).
5. `python generate.py` to build `tasks/`.
6. Verify: `pytest problems/<topic>/<slug>` (reference green) and
   `pytest tasks/<topic>/<slug>` (stub should fail with NotImplementedError).

## Classes (taught courses)

A third content family, for lecturing from the reveal.js decks in
`~/IdeaProjects/avalur.github.io/ai_club/`. Same file-first shape as above:

- **Source of truth = `classes/<class>/`.**
  - `class.json` — title, `teacherEmails`, and `lessons[]` (slug, title, date,
    `deck`, `practice[]`, `homework{due,items[]}`, optional `revealOverrides`).
    A practice entry is a `problem`, a `notebook`, or a **`link`** —
    `{type, title, href}` for work that lives off-site (a Colab notebook, a
    dataset). A link is **practice only**: `export_decks.py` refuses one in
    `homework`, and the TS type says so too (`Homework.items` is `TrackedItem[]`,
    which excludes `LinkRef`). The homework page is a roster of who handed what
    in, and an untrackable column would read as a class that all failed. The
    same asymmetry is the one trap in the UI: `flatten()` drops links, so
    `flatten([link]).every(done)` is `[].every()` — **`true`** — and a link ticks
    itself as done unless the render branches on `isLink` first. Covered by
    "practice links open off-site and are never ticked" in `classes.spec.ts`.
  - `decks/<deck>.html` — a per-class **copy** of a deck, edited freely in
    PyCharm. It is a *fragment*: the deck's `<style>` plus `<div class="slides">`,
    no `<html>`/`<head>` — the exporter supplies the page shell.
  - `assets/` — images and PyScript `.toml` files the decks reference.
- **`web/public/classes/` is generated** by `export_decks.py` — never hand-edit.
  Per lesson it emits `<class>/<lesson>/present.html`, plus `_shared/` (reveal
  subset, self-hosted KaTeX, html2canvas, jsPDF, `annotate.js`, `fitslides.js`)
  and `manifest.json` (read at request time — `classes/` lives outside `web/`
  and is not deployed to Vercel). A class or lesson dir with nothing behind it in
  the manifest is **deleted** on build (and flagged by `--check`), so renaming a
  slug can't leave the old URL published.
- Only assets the **live** lessons reference are published: `needed_assets()`
  scans each listed deck for `assets/…` refs (plus the data files a pyscript toml
  mounts). A class keeps decks for lessons it no longer lists, and their images
  have no business on the CDN — that alone took this class from 11 MB to 1.6 MB.
  `--check` fails on both a missing and a stale published asset, and
  `web/tests/e2e/assets.spec.ts` loads every lesson and verifies each image and
  reveal background actually resolves.
- Renaming a class **slug** also needs the `Class` row renamed in place
  (`prisma.class.update`), not re-synced: `sync-classes.cjs` matches on slug, so
  it would create a second row and orphan the existing enrollments, group codes
  and lesson sessions.
- **Only dynamic state is in Postgres**: `Class` (seeded), `ClassInvite`,
  `ClassEnrollment`, `LessonSession`, `LessonAnnotation`. Homework completion is
  *derived* from `UserProblemProgress`/`UserNotebookProgress` — no extra table.
  Authorization is `session.user.email ∈ Class.teacherEmails`.
- **A class is published or a draft**, and `Class.publishedAt` (null = draft) is
  the only truth. A draft is complete and presentable but belongs to its
  **teachers alone**: absent from `/classes`, 404 on its own pages and lesson
  pages, and its group codes enroll nobody. Every caller asks the same question,
  `access.visible` from `getAccess()` (`published || isTeacher`); the list pages
  use `visibleClasses()`, which also treats a class with **no `Class` row** as
  hidden — nothing is visible before `db:sync-classes` has run.
  - `"draft": true` in `class.json` picks the state the row is **created** with
    and nothing else. `sync-classes.cjs` never writes `publishedAt` on update: it
    only prints a `⚠` when the file and the DB disagree. Otherwise a routine sync
    would hide a running course, or undo a Publish pressed an hour earlier.
  - Publishing happens either from the site (the teacher's **Publish** button →
    `POST /api/classes/<slug>/publish`) or from here
    (`pnpm db:sync-classes --publish <slug>` / `--unpublish <slug>`).
  - Draft lessons are **still exported**. `present.html` is a static file under
    `web/public/`, so skipping it would mean the button could not put a class
    online without a deploy. So a deck URL stays fetchable by anyone who knows
    it — nothing links there, there is no sitemap, and `classes/` is committed to
    a public repo anyway: "hidden" means unlisted and unreachable *through the
    app*, not confidential.
  - The e2e coverage runs on a **scratch class** (`draftClass()` in
    `tests/e2e/support/session.ts`, a temporary manifest entry plus a hidden row),
    never by hiding the real course: the suite talks to the live database, and a
    killed run would leave `ml-intensive-tlf` 404ing on the public site.
- **Published classes are public.** The course, its lessons, its slides and its
  task lists need no account — the one exception is the annotated lecture notes. A code
  therefore does not unlock anything: it puts a student in a **group**
  (`ClassInvite`, one per cohort, written by the teacher on the homework page),
  and `ClassEnrollment.inviteId` records which one they typed. The homework
  overview lists exactly the people with a code; teachers are enrolled without
  one, which is what keeps them out of their own student table. Lookup is on
  `codeKey` (upper-cased, separators stripped), so "TLF-OSEN-A", "tlf osen a"
  and "tlfosena" are one code. A code with students behind it cannot be deleted —
  that would erase which group they are in. The delete is one `deleteMany`
  filtered on `enrollments: { none: {} }`, so somebody joining at that exact
  moment cannot slip between the check and the delete.

Bringing a deck over: `python tools/import_decks.py --class <slug> --deck all`.
It keeps `<div class="slides">` verbatim (so in-slide `<script type="py-editor">`
blocks survive), rewrites image refs to `assets/`, re-encodes them (JPEG when
opaque, WebP when there's alpha — a resized photographic PNG stays huge), and
reports every page-level script it drops. Re-run it only when re-importing; the
regular build is `export_decks.py`.

A deck may keep its CSS in a sibling `.css` file instead of a `<style>` block
(both `building-ai-agents` decks do). The importer **inlines** linked local
stylesheets into the fragment, in head order, because a fragment has no `<head>`
for a `<link>` to survive in — without it the deck imports cleanly and renders
completely unstyled, which reads as a broken theme. A stylesheet can carry
images too, so `url(...)` refs inside it are copied and rewritten to `assets/`
just like markup refs.

**An asset can be referenced only from CSS**, and that path is easy to break in
three separate places, none of which raise: `ASSET_REF_RE` has to count
`url(assets/…)` or the file looks unused and gets pruned (with `--check` calling
it stale); `absolutize_assets` has to rewrite the `<style>` block and not just
the slides, since `present.html` sits one directory below the published assets;
and `tests/e2e/assets.spec.ts` has to walk `getComputedStyle().backgroundImage`,
because such a background is neither an `<img>` nor a `data-background-*`
attribute. Miss any one and the slide simply loses its picture. That suite
asserts on same-origin URLs only — pruning can only break what we publish, and a
deck that hotlinks a third-party image shouldn't fail CI on someone else's
downtime.

Present mode lives at `/classes/<class>/<lesson>/present.html`; adding
`?session=<id>` (the teacher's "Present" button) is what attaches the ink layer.
Deliberately a standalone page, not a Next.js route: `reveal.css` restyles
`html`/`body` globally and PyScript needs a real document to scan.

**Authoring a deck by hand** (the normal way Alexander writes slides): run
`python export_decks.py --watch` next to `pnpm start`, edit
`classes/<class>/decks/<deck>.html` in PyCharm, and keep the lesson open at
`…/present.html?dev=1`. The watcher rebuilds only the lessons whose deck changed;
`devreload.js` polls the page's own ETag and reloads it, and `hash: true` puts you
back on the slide you were looking at. There is deliberately **no dev renderer** —
the page you author against is the file that ships. Two consequences to remember:
- the exporter uses `write_if_changed`, so a rebuild that produces identical bytes
  leaves the mtime (and the ETag) alone — without that, every save would reload
  every open tab;
- `next start` lists `public/` at boot: editing an existing file is picked up per
  request, but a **new** file (an image just added to `assets/`, a new lesson, a
  new `_shared/` script) 404s until the server restarts. `next dev` has no such
  cache — verified — so **author against `pnpm dev`**, and keep `pnpm start` for
  checking the real production build.

Blank grid boards are **real reveal sections** injected into the deck at runtime,
not an overlay — they navigate, export and behave like slides. The deck file on
disk is never touched; `LessonSession.boards` (`[{id, afterId}]`) is the only
record of where they went, and a reload re-inserts them.

"Finish lesson" renders every slide with its ink to a PDF, **downloads it to the
teacher's machine** and, in the background, publishes a copy for the class. It
calls `POST …/sessions/<id>/finish` twice: once with `{bytes}` (sets `endedAt` —
the "delivered" badge) and again with `{url}` once the upload lands (sets
`pdfUrl` — the download link on the class and lesson pages). The two are separate
on purpose: with no Blob store, or no network, the lesson is still delivered and
the teacher still has the file.

**Why the upload takes a detour through an iframe.** The PDF is far too big to
POST to a route — a Vercel serverless request body caps at 4.5 MB and a 36-slide
deck already measures 4.9 MB (61-slide `decision_trees` would be ~8 MB) — so it
has to go client-side straight to Blob storage. But `present.html` is a static
page with no bundler and cannot import `@vercel/blob/client`. So it opens
`/classes/blob-bridge` (a real Next page) in a hidden same-origin iframe and
hands the `Blob` over with `postMessage`, which structured-clones it natively.
Three things this buys, all of them load-bearing:
- the teacher's cookies ride along, so `/api/blob/upload-token` can check
  `teacherEmails` before minting what is a **write capability** on the store,
  scoped to `classes/<class>/<lesson>/` and `application/pdf`;
- a separate browsing context is immune to the `<a download>` abort (below), so
  the upload survives the teacher's own file landing;
- `handleUpload` is deliberately configured **without** `onUploadCompleted` — that
  callback needs a publicly reachable URL and so never fires on localhost. The
  browser reports the URL to `/finish` instead, which behaves identically in dev
  and prod.

The store is **private**, so the object URL recorded in `pdfUrl` answers 403 to
everybody — including us. The download link is
`GET /api/classes/<slug>/lessons/<lesson>/notes`: it checks membership, issues a
delegation (`issueSignedToken`) and `presignUrl`s a 10-minute GET, then 307s to
it. The bytes never pass through the function, and `&download=1` is not part of
the signed payload, so appending it is safe and is what makes the browser save
the file instead of opening it. Two traps worth remembering:
- `presignUrl` needs `access: 'private'` passed explicitly. Omit it and the host
  comes out as `<store>.undefined.blob.vercel-storage.com`, which fails DNS.
- a private store rejects `access: 'public'` uploads with a clear message that the
  **browser never sees** — the error response carries no CORS header, so Chrome
  reports "blocked by CORS policy" instead. If a client upload dies on CORS,
  reproduce it server-side with `put()` before believing the browser.

Setup is one env var, `BLOB_READ_WRITE_TOKEN` (see `web/.env.local.example`);
without it the token route answers 501 and present mode says "not published"
while still handing the teacher the file.

Four non-obvious invariants:
- reveal is initialised at a **fixed 1280×720**, not the source decks'
  `width:'100%'`. Ink is stored normalized to the slide box, so a fixed aspect
  ratio is what keeps strokes aligned across window sizes and in the PDF.
- `fitslides.js` scales down any slide whose content overflows (118 of 341 do).
  It re-measures on a delay ladder plus `document.fonts.ready`, because the
  theme's webfonts and async KaTeX both change text metrics after `ready`.
- Ink is keyed by a stable `data-mlp-id` (`s<n>` for deck slides, `b<n>` for
  boards) stamped **before** any board is inserted — never by reveal's `h.v`
  indices, which shift the moment a board is added or deleted.
- The laser draws **only while the pointer is pressed** (touch included — palm
  rejection is for ink, and tapping the iPad is how you point). Hovering paints
  nothing; that is also why there is no Tail on/off switch, since letting go is
  what ends a trail. Within a press it is driven by **movement, not by point
  age**: one shared fade level that only rises after `LASER_HOLD` ms of stillness
  and walks back down as soon as the pointer moves, so a pause mid-explanation
  doesn't cost the trail (Notability's "Tail"). Red is the laser's alone — it is
  deliberately absent from the pen palette, so red on screen always means
  "pointer, not ink".
- Board-list writes are chained, and only ink gets a `keepalive` flush on
  unload. Each board PUT replaces the whole list, so two in flight can land out
  of order; and re-sending the list on unload would race the next load's GET.
- `finishLesson` posts to `/finish` **before** triggering the download: clicking
  an `<a download>` aborts requests started after it, which silently swallowed
  the call when it ran second. The Blob upload starts before it too, and runs in
  the bridge iframe for the same reason.
- Before capturing, `finishLesson` sets **inline** `z-index` on `.slides` (10)
  and `.backgrounds` (1). html2canvas ignores reveal's stylesheet `z-index` and
  paints siblings in DOM order, where `.backgrounds` comes last — so every slide
  with an opaque `data-background-color` exported completely blank. The PDF still
  had the right page count, which is why `tests/e2e/classes.spec.ts` checks each
  page for pixels and not just the count.

In-slide links to site tasks use `<a class="practice" href="/problems/…">`;
`export_decks.py` validates every one of them (and every `class.json` id) against
the problem/notebook manifests and **fails the build on a typo**.

PyScript in the decks, four things learned the hard way:
- a py-editor must call `matplotlib.use('Agg')` **before** importing `pyplot`.
  Editors run in a worker, where matplotlib's Pyodide backend does
  `from js import document` and `plt.subplots()` dies with an ImportError. The
  decks only ever `savefig`, so a non-interactive backend is what they want;
  `validate_matplotlib_backend` fails the build when the order is wrong, per env.
- a `[files]` key in a `pyscript.toml` resolves against **the toml's own URL**, and
  the toml is copied into `assets/` — so keys must be bare filenames. A key that
  404s is mounted as an *empty* file, so the slide prints nothing instead of
  failing; `validate_py_configs` now fails the build on it.
- `config` may appear on **only one** py-editor per `env`. Copying it onto the
  others (to survive running them out of order) makes PyScript throw
  "duplicated config for env: …" at boot and stop upgrading editors — don't. It
  is unnecessary anyway: configs are registered when the tags are parsed, so the
  packages are there whichever editor of that env runs first.
- `write_if_changed` renames a temp file into place. `--watch` rewrites pages the
  dev server is serving, and a truncating overwrite can hand a browser half a
  page — which looks exactly like a deck whose py-editor config vanished.

## Brain teasers

Puzzles under `/brainteasers`, listed by the hardcoded `TEASERS` array in
`web/src/app/brainteasers/page.tsx`. Almost no database: each teaser is a page
that carries its own content. Conventions the **Math Abacus** added, worth
following for the next one:

- Content is a typed module, `web/src/content/abacus.ts` — the three age variants
  (`hard` 10–12, `extreme` 13–15, `nightmare` 16+), their themes, costs and both
  translations of every statement, so a half-translated theme is a type error.
  Statements are markdown with `$…$` / `$$…$$`. A variant is a whole separate 3×3
  board; the board's progress key is per level (`mlp:abacus:v1:<level>`), because
  they are three different games sharing one page.
- **A teaser can be a draft.** `TeaserState.publishedAt` in Postgres is the only
  truth and **no row means draft**, so a new puzzle is private the moment it
  exists and nothing goes live by being deployed. `teaserAccess(slug)` in
  `web/src/lib/teasers.ts` is the single gate (`visible = published || admin`);
  the list page, both abacus pages and the API route all ask it. Publication is
  one flag for the whole game — publishing shows all three levels.
- Who may press Publish is **`ADMIN_EMAILS`** (`web/src/lib/admin.ts`), a
  comma-separated env var, not a column: the list changes without a migration,
  and unset means *nobody*, so a deploy that forgets it hides the button rather
  than handing it out. Classes are unaffected — those still authorize against
  `Class.teacherEmails`. Set it in Vercel, or Publish is dead in production.
- `web/src/lib/abacus.ts` is client-safe (types, `isOpen`, `cellKey`);
  `abacus-render.ts` is the server half that pulls in `marked` and `katex`.
  Statements are rendered to HTML **on the server, in both languages** and handed
  to the board, so neither library ships to the browser and switching language
  costs no round trip. Math is masked out before `marked` runs and spliced back
  after — markdown otherwise eats the `_` and `*` inside a formula.
- Russian is scoped to these pages (`mlp:abacus:lang`, or `?lang=` on the URL);
  the rest of the site stays English. Progress lives in localStorage — the
  hand-in order is the whole game, but who solved what is not ours to record.

**Pictures are TikZ.** Sources in `figures/<name>.tex`, compiled by
`python tools/build_figures.py` (TeX Live: `latex` → `dvisvgm`) into the committed
`web/src/content/figures.generated.ts`, and dropped into a statement with
`${figure("abacus/tiles-in-a-box")}` on its own blank-line-separated paragraph.
Inline SVG rather than a file under `public/` for one reason: the builder rewrites
black to **`currentColor`**, so a single drawing follows the dark theme, the light
theme and the printed sheet. Hence: every *stroke* is black in the source, and
fills are **mid-tone**, because they sit under a white line on the dark theme and
a near-black one on the light one. Transparency is out — the dvisvgm route does
not carry it.

A drawing with **words** in it is built once per language: the source defines
`\lang{русский}{english}` over `\ifdefined\figlangru`, the builder compiles it
twice (`\def\figlangru{1}\input{…}`) and emits two keys, `<name>.ru` and
`<name>.en`. Load `fontenc` with **`[T1,T2A]`** — T2A last, so it is the default
and carries Cyrillic *and* Latin. `--no-fonts` turns glyphs into paths, so no
label text survives in the DOM; a test can only compare the two SVGs, not read
them.

`--check` compares the **sha256 of each .tex** recorded in the generated file, so
CI catches a source edited without a rebuild while only this machine needs LaTeX.

The e2e suite reads the draft board by **signing in as an editor**
(`e2e-admin@example.test`, listed in the local `ADMIN_EMAILS`), so the board tests
write nothing. Only the publish test flips the real row, and `teaserState()` in
`tests/e2e/support/session.ts` records the state on the way in and restores it —
there is one abacus and no way to fake up a scratch one, unlike a class.

Printing is a real page, `/brainteasers/abacus/print?lang=ru|en|both&level=…`, plus the
browser's own Print dialog — vector text and real KaTeX, where jsPDF would
rasterize. Two traps, both found by exporting an actual PDF and looking at it:
`.statement` is a dark panel on screen and prints as a black box unless the
`@media print` block strips it, and `html`/`body` **animate** their colours, so a
print job that starts mid-transition puts a half-dark frame on paper — hence
`transition: none` in that block. `tests/e2e/brainteasers.spec.ts` asserts both by
emulating print media.

## Accounts and sign-in

Auth.js v5 with the Prisma adapter and **database** sessions: a session is a
`Session` row plus the `authjs.session-token` cookie (`__Secure-` prefixed over
https). Google and GitHub link on verified email, so one address is one account.

A person's name is stored **twice**: `firstName`/`lastName` are what the user
types (registration asks for them right after the email, `/profile?tab=account`
changes them later, `POST /api/account/profile`), and `name` is the display
string every other page already reads — the header, class rosters, the monitor
feed — rewritten from the two halves on every save. OAuth accounts arrive with
only a `name`, so `splitName()` in `src/lib/person.ts` shows it back split on
the first space rather than an empty form; there is no backfill and none is
needed.

Email+password sits **next to** Auth.js rather than inside it, in
`/api/account/{register,login,forgot-password,reset-password}` with pages
`/signin`, `/register`, `/forgot-password`, `/reset-password`:

- Auth.js's own Credentials provider refuses to run under the database strategy.
  But a session here is just a row and a cookie, so `src/lib/session-cookie.ts`
  writes both and `auth()` reads them back as its own — including Sign out.
  **The cookie name must match Auth.js's exactly**, prefix and all, or the
  session it looks up will not be the one just created.
- Hashing is `scrypt` from node:crypto (`src/lib/password.ts`), parameters stored
  in the hash string. No bcrypt/argon2 dependency to break on a deploy.
  `verifyPassword(pw, null)` deliberately does **not** return early: it verifies
  against a dummy so an unregistered address cannot be told from a wrong password
  by timing. Restoring the early return is a silent account-enumeration leak, and
  is what `tests/e2e/password.spec.ts` measures. The dummy is **random bytes in
  the shape of a hash**, built once at import — not `hashPassword()` of anything:
  deriving it on first use would make the first absent-account request in each
  process cost two scrypts, and on serverless that is most of them.
- Registering onto an **existing** address is refused, never adopted: otherwise
  anyone who knows the address of a Google user could put a password on their
  account. Proving you own the address is what the reset flow is for, and it
  works for OAuth-only accounts — that is how they get a password.
- Reset tokens are stored **hashed** (SHA-256), single use, one hour, one letter
  a minute per account. A successful reset drops every other session and marks
  `emailVerified` — following the link is the proof. "Single use" is an atomic
  `updateMany` on `(tokenHash, usedAt: null, not expired)` — reading the row and
  checking `usedAt` in separate statements lets two concurrent requests both
  through. The password is validated against the account's email *before* the
  claim, so a typo does not burn the link.
- The emailed link is built from `siteOrigin()` (`SITE_URL`), never from
  `req.url`: Auth.js runs with `trustHost: true`, so the request carries whatever
  Host arrived, and a reset link derived from it can be aimed at another domain.
- `forgot-password` answers the same sentence whether or not the address is
  registered, and `login` answers the same sentence for "no such user" and "wrong
  password" (and hashes anyway, so both take the same time). Eight failures lock
  an account for 15 minutes.
- Every cookie-authenticated mutation — account **and** class routes — starts
  with the same two lines from `src/lib/http.ts`: `crossSite(req)` and
  `jsonBody(req)`. `SameSite=Lax` still allows a cross-site POST and Auth.js's
  CSRF token only covers the routes Auth.js serves, so the origin (scheme
  included) is checked per route; and `jsonBody` returns null for a body that is
  not an object, because `await req.json()` can legitimately be `null` and the
  first property read then answers 500 instead of 400.
- `rateLimited()` bounds the anonymous endpoints per IP, in memory, best-effort:
  login and register each burn a scrypt per call and the account lockout cannot
  help, since invented addresses never hit the same account twice. The limits are
  sized for **a classroom behind one NAT address** — locking a lesson out would
  be the worse failure.
- Mail goes through Resend over plain `fetch` (`src/lib/mailer.ts`). With no
  `RESEND_API_KEY` the letter is printed to the server log instead, so the whole
  flow works locally and in CI with nothing configured. Prod needs
  `RESEND_API_KEY` and a verified sender domain in `MAIL_FROM`.

## Commands

```bash
python generate.py            # rebuild tasks/ from problems/
python generate.py --check    # CI: fail if tasks/ drifted from problems/
python export_decks.py        # rebuild web/public/classes/ from classes/
python export_decks.py --check # CI: fail if class decks drifted
python export_decks.py --watch # authoring: rebuild on save (use ?dev=1 in the browser)
python tools/build_figures.py         # rebuild the TikZ figures (needs TeX Live)
python tools/build_figures.py --check # CI: a .tex edited without a rebuild
pytest problems -q            # CI: all reference solutions must pass
pytest tasks/<topic>/<slug>   # run a student stub
cd web && pnpm db:sync-classes # upsert Class rows (group codes are made in the UI)
cd web && pnpm db:sync-classes --publish <slug>   # put a draft class on the site
cd web && pnpm db:sync-classes --unpublish <slug> # take it back off
```

CI (`.github/workflows/ci.yml`) runs the `--check` + `pytest problems` pair on
push/PR. So: **always regenerate and run `pytest problems` before committing.**

## Design principles for good tasks

- One concept per task; solvable by hand without AI.
- Ban the helper that would make it a one-liner so the student writes the
  mechanics (e.g. forbid `sklearn`/`scipy`; forbid loops when vectorization is
  the lesson).
- Deterministic tests; compare against an independent oracle, not a copy of the
  reference solution.

## Course topic map (candidate task areas, from avalur.github.io/mlcourse)

Use as a backlog when batch-authoring. `numpy_basics` is the only one started.

- Python/NumPy/Pandas basics — broadcasting, vectorization, indexing.
- Intro ML — linear regression, train/test split, overfitting, metrics.
- Matrix differentiation — gradients of common losses.
- Linear models & SGD — gradient descent, regularization.
- Metric methods — KNN, distance computations.
- Decision trees — splits, impurity (Gini/entropy).
- Ensembles — bagging, random forest, gradient boosting.
- Neural nets & backprop — forward/backward of layers by hand.
- CNNs / RNNs — convolutions, sequence models.
- Attention & Transformers — softmax attention, tokenization.
- Clustering & dim-reduction — K-Means, PCA, t-SNE, DBSCAN, EM.
- Bayesian methods — MCMC, Gibbs sampling.
- Generative & RL — VAE/GAN basics, Q-learning, MDPs.

(See the live syllabus for the authoritative, fuller list.)
```
