# CLAUDE.md

Working notes for Claude Code in this repo. Read this first; it encodes the
conventions and the exact recipe for adding tasks so I don't re-derive them.

## What this repo is

"LeetCode for ML": many small Python ML tasks that students solve **by hand**
(no AI, no ready-made helpers) and verify with pytest. Companion to the course
at https://avalur.github.io/mlcourse. Author/owner: Alexander Avdiushenko
(`avalur`). He chats in Russian but **all repo artifacts are in English**, and
he likes to brainstorm design tradeoffs before I build.

## Architecture (don't break these invariants)

- **Source of truth = `problems/<topic>/<slug>/`.** Never hand-edit `tasks/`.
  - `reference.py` — working solution. The body between
    `# --- solution: begin ---` and `# --- solution: end ---` is stripped to
    make the student stub. Everything else (imports, signature, docstring) is
    kept verbatim, so put the full problem context in the docstring.
  - `test.py` — pytest. Runs against BOTH trees via the `impl` fixture, so it
    must not assume which file backs the implementation.
  - `meta.py` — a `META` dict: `title`, `topic`, `difficulty`
    (easy/medium/hard), `entry`, `statement`, and `banned`.
- **`tasks/<topic>/<slug>/` is generated** by `generate.py` (submission stub +
  copied test.py/meta.py + rendered README.md). Regenerate after any edit.
- **Constraints are enforced statically** by `tools/checks.py` via `ast`.
  `banned` keys: `modules` (import roots, e.g. `scipy`, `sklearn`), `names`
  (identifiers/attrs, e.g. `cdist`, `norm`), `loops` (truthy → no `for`/`while`).
  The `assert_clean(impl_source, banned)` check only inspects the student's
  source — test code is trusted, so loops in a brute-force reference oracle are
  fine.

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

## Commands

```bash
python generate.py            # rebuild tasks/ from problems/
python generate.py --check    # CI: fail if tasks/ drifted from problems/
pytest problems -q            # CI: all reference solutions must pass
pytest tasks/<topic>/<slug>   # run a student stub
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
