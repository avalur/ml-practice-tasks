# Building AI Agents — source

Imported from `~/IdeaProjects/avalur.github.io/building_ai_agents/` with
`python tools/import_decks.py --src … --class building-ai-agents --deck all`.
The class is a **draft** (`"draft": true` in `class.json`), so it is visible to
its teachers alone until someone presses Publish.

## Lessons

| Lesson | Deck | Source |
|---|---|---|
| `l01-intro-agents` — From LLM to AI Agents | `decks/intro_ai_agents.html` | `Intro_AI_agents.html` |
| `l02-tools-mcp` — Tools and MCP | `decks/tools_mcp.html` | `Tools.MCP.html` |

Decks were renamed to snake_case to match the rest of the repo (`Tools.MCP` also
put a dot in a filename that the exporter treats as a stem).

Both source decks keep their CSS in sibling `.css` files rather than a `<style>`
block, and `Tools.MCP.css` carries a slide background as a `url(...)`. The
importer inlines the stylesheets into each fragment and rewrites those CSS
references into `assets/`, so a fragment stays self-contained. `Intro_AI_agents.css`
is shared by both source decks and is therefore inlined into both fragments —
that duplication is deliberate, matching the one-copy-per-class rule for decks.

**Dates in `class.json` are placeholders** (the title slide says October 2026).
Set the real ones before the course runs.

## Practice

`practice/` holds the two Jupyter notebooks that go with lecture 1 (about three
hours of work). They are **not** wired into `class.json`, and cannot be as they
stand:

- `Intro_AI_Agents_part1.ipynb` — how to use LLMs: local inference with
  `llama-cpp-python` on a GGUF model, Hugging Face, then a hosted API.
- `Intro_AI_Agents_part2.ipynb` — the first agent, built on τ²-bench's airline
  task with LangChain/LangGraph.

Three things block them from becoming site content: both are Colab notebooks
(`google.colab` secrets) needing an `OPENAI_API_KEY`, part 2 wants a `tau2-bench`
checkout beside it, and `llama-cpp-python` and the rest are unavailable in the
browser's Pyodide runtime, where `notebooks/` entries run. So the delivery route
is still open — Colab links, a downloadable asset, or a marimo port against a
recorded transcript. The `tau2-bench` clone was deliberately left behind: it is a
1.1 GB git checkout of a third-party repository.

Note these notebooks teach **OpenAI + LangGraph**, which cuts against the
by-hand-then-SDK, Anthropic-flavoured plan in `plan_ai_agents_course.md`. Worth
settling before the practice is rebuilt.

`tools_practice/` in the source tree is empty — lecture 2 has no practice yet.

## Not copied

The source directory also contains a `.env` file. It stays out of this repo.
