# Course Design: Building AI Agents

A design document, not an execution script. It records the decisions we agreed on
and the ones still open, so the build can start from a settled shape.

- **Format**: club course, 8–10 weeks, one lecture per week.
- **Audience**: the students who already did the ML track — numpy, linear models,
  backprop, transformers. We can say "embedding" and "cosine similarity" without
  a preamble, and we can lean on that in the retrieval week.
- **Stack**: by hand first, SDK second. Weeks 1–7 build every mechanism from
  scratch against a fake model; weeks 8–9 rewrite the same agent on the real
  Anthropic SDK, so the framework arrives as a *relief*, not as magic.
- **Practice**: three tiers — `problems/agents_*` (mock LLM, deterministic),
  `notebooks/ai_agents/` (marimo, real API with a recorded fallback), and a
  capstone repository.

---

## The keystone decision: the fake model speaks the real wire format

Everything else follows from this one choice.

The repo's task pipeline is offline and deterministic: pytest in CI, Pyodide in
the browser, no keys, no network. Agents are the opposite. The way out is a
**scripted LLM injected as a test fixture** — but the crucial detail is that it
returns objects shaped *exactly* like a real `Message` from the Messages API:

```python
# what the fixture hands back
response.stop_reason          # "end_turn" | "tool_use" | "max_tokens" | ...
response.content              # list of blocks
block.type                    # "text" | "tool_use"
block.id, block.name, block.input   # on a tool_use block
```

So the loop a student writes in week 3 is *the same code* that drives
`anthropic.Anthropic()` in week 8. The swap is one line — the client. That is the
whole "руками, потом SDK" plan made real, and it is why we should not invent a
cute teaching-shaped protocol of our own.

Two consequences worth stating:

- Blocks must be **attribute-accessible**, not dicts. The real SDK returns
  objects; a student who writes `block["type"]` in week 3 has learned something
  that breaks in week 8.
- The fake client **records every request it received**. That is the independent
  oracle the repo's design principles ask for: the test does not check "did you
  get the right answer" (the answer is scripted), it checks **"did you build the
  right conversation"** — did you append the assistant turn verbatim, did you
  return every `tool_result` with a matching `tool_use_id`, did you put parallel
  results in a *single* user message, did you stop when told to stop.

### Proposed `conftest.py` fixture

Added next to `impl` / `impl_source` / `banned` / `rng_for`. It ships to the
browser for free: `export_web.py` copies the root `conftest.py` into
`web/public/content/_shared/`, and `runner.ts` mounts it at the task root.

```python
@pytest.fixture
def scripted_llm():
    """Factory for a fake Anthropic-shaped client.

    scripted_llm([resp, resp, ...])   -> replies in order
    scripted_llm(lambda request: ...) -> replies as a function of the request

    The returned client exposes `.messages.create(**kwargs)` and records every
    call on `.calls`, so a test can assert on the conversation the student built.
    """
```

Pure stdlib, so `py_deps: []` for every `agents_*` topic except the retrieval
ones, which want numpy.

### Uniform `banned` for `agents_*`

```python
"banned": {"modules": ["anthropic", "openai", "langchain", "requests", "httpx", "aiohttp"]}
```

Keeps the work by hand and offline, and makes the intent explicit to the student:
you are writing the thing the SDK would have written for you.

---

## Problem topics to create

| Topic | Teaches | `py_deps` |
|---|---|---|
| `agents_protocol` | Message/content-block shape; read `stop_reason`; build the next request; assemble streaming deltas | `[]` |
| `agents_tools` | Tool registry, JSON-Schema argument validation, dispatch, `tool_result` / `is_error` | `[]` |
| `agents_loop` | The agent loop: step budget, parallel tool calls, retries with backoff, termination | `[]` |
| `agents_memory` | Token budgeting, truncation vs summarization, prompt-cache prefix reasoning | `[]` |
| `agents_retrieval` | Chunking, BM25 by hand, cosine top-k, reranking | `["numpy"]` |
| `agents_eval` | Trajectory vs outcome scoring, rubric grading, regression harness | `[]` |

Each follows the standard recipe: `reference.py` with the solution between the
markers, `test.py` with a trusted oracle plus `test_no_banned_constructs`,
`meta.py`, then `python generate.py`.

---

## Lecture plan

Nine lectures plus a demo session. Each lecture gets a hand-written deck in
`classes/building-ai-agents/decks/` — there is nothing about agents in
`~/IdeaProjects/avalur.github.io/ai_club/`, so all ten decks are new.

1. **What an agent actually is.** LLM + tools + loop + memory, and nothing more.
   The Messages API as a wire format: roles, content blocks, `stop_reason`. Why
   the agent is a `while` loop. And the honest question first — *should* this be
   an agent? The four criteria: complexity, value, viability, cost of error. A
   single call or a fixed workflow beats an agent most of the time.
   → `agents_protocol`
2. **Tools.** Definitions as JSON Schema; why the description is the prompt;
   registry and dispatch; validating arguments; returning errors *into* the loop
   instead of raising. Designing the tool surface: one bash tool versus many
   narrow ones, and what that costs you in gating, rendering, and auditing.
   → `agents_tools`
3. **The loop.** ReAct in its plainest form. Dispatch on `stop_reason`; append
   the assistant turn verbatim; parallel tool calls all come back in **one** user
   message; step budgets; retries and backoff; what "done" means.
   → `agents_loop/run_agent`
4. **Context and memory.** The context window as a budget. Truncation,
   summarization, clearing old tool results. Prompt caching as a **prefix match** —
   why `datetime.now()` in a system prompt costs you the entire cache, and why
   tools render before system.
   → `agents_memory`
5. **Retrieval.** Chunking strategies; BM25 by hand; embeddings and cosine top-k
   in numpy; reranking; citations. The week that leans hardest on what they
   already know.
   → `agents_retrieval`
6. **Structure and planning.** Constrained JSON output and strict tool schemas;
   planner/executor; task decomposition; when a plan is worth writing down.
   → `agents_planning` (or fold into `agents_tools` if the week is thin)
7. **Evaluation and tracing.** The week most agent courses skip. Trajectory
   versus outcome; rubric grading; LLM-as-judge (with a *mocked* judge, so it
   stays deterministic); regression suites; accounting for cost and latency.
   → `agents_eval`
8. **Real API day.** Swap the fake client for `anthropic`. Model IDs and real
   pricing; adaptive thinking and the effort parameter; streaming; measuring the
   cache with `usage.cache_read_input_tokens`. Then the Tool Runner: the loop
   they wrote in week 3, in ten lines. Same for the notebooks.
9. **MCP and multi-agent.** What MCP is and which problem it solves; connecting a
   server; orchestrator and subagents, and why each delegation costs a round trip
   and a re-briefing. Then safety, which belongs here and nowhere else: **a tool
   result is untrusted input**, permission gates, confirmation on irreversible
   actions.
10. **Capstone demos.**

### API facts to teach (verified, 2026-08)

Worth pinning in the deck, and re-checking before the course runs — these move:

- Model IDs are bare strings, no date suffix: `claude-opus-5` ($5/$25 per MTok),
  `claude-sonnet-5` ($3/$15), `claude-haiku-4-5` ($1/$5), `claude-fable-5`
  ($10/$50). Sonnet 5 has introductory pricing ($2/$10) through 2026-08-31 —
  likely expired by the time we teach; check.
- `temperature` / `top_p` / `top_k` are **rejected** on the current models, and
  `thinking` is now `{"type": "adaptive"}` with `output_config.effort`, not a
  token budget. Every tutorial on the internet still sets `temperature=0` — worth
  one slide, because the students will hit it.
- MCP over the API needs **both** halves: `mcp_servers=[...]` *and* a matching
  `tools=[{"type": "mcp_toolset", "mcp_server_name": ...}]`.
- Tool Runner (`client.beta.messages.tool_runner`) and the Claude Agent SDK are
  different products. Worth being precise about, since the names invite confusion.

---

## Notebooks: `notebooks/ai_agents/`

marimo, same shape as `transformers/`. Real API, with **recorded responses as a
fallback** so every notebook runs in CI and for a student with no key: a
`cassette.json` of real exchanges, and a client that replays it when
`ANTHROPIC_API_KEY` is unset. Same fake-client contract as the test fixture, so
one implementation serves both.

Candidates: `first_call`, `tool_use`, `agent_loop`, `rag`, `evaluate`.

**Open question — Pyodide.** The notebooks currently run in the browser. A
notebook that calls a real API cannot. Either these notebooks are marked
local-only (a new capability the manifest does not have today), or they run
cassette-only in the browser and live only for the key-holders. This needs a
decision before the notebook section is built.

---

## Capstone

Student builds an agent end to end and hands in a repository: a real tool
surface, a loop they own, an eval set, and a written account of what it costs
per run. Graded by hand, not by tests. Proposed constraint: it must do something
that genuinely needs an agent — if a single call or a fixed script would do, that
is the finding, and saying so earns full marks.

---

## Open questions

1. **Keys for the notebook weeks.** Do students get keys, does the course
   provide a shared proxy, or is week 8 a demo from the lectern with cassettes
   for everyone else? This changes lectures 8–9 and the capstone's shape.
2. **Pyodide and the API notebooks** — see above.
3. **Deck count.** Ten new decks by hand is the largest single cost in this plan.
   Worth deciding early whether some lectures are practice-only.
4. **`agents_planning`** — its own topic, or folded in? Depends on how lecture 6
   fills out.

## Build order

1. `scripted_llm` in `conftest.py` + one end-to-end task in `agents_loop` to
   prove the fixture teaches what we think it teaches.
2. The rest of `agents_protocol` / `agents_tools` / `agents_loop` — enough
   practice to back lectures 1–3.
3. `classes/building-ai-agents/class.json` and the first three decks.
4. Everything else, lecture by lecture.
