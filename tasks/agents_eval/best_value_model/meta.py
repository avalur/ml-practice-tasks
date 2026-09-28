META = {
    "title": "Best Value Model",
    "topic": "agents_eval",
    "difficulty": "easy",
    "entry": "best_value_model",
    "order": 1,
    "py_deps": [],
    "banned": {
        "modules": ["anthropic", "openai", "langchain", "requests", "httpx", "aiohttp"],
    },
    "hints": [
        "First filter out models that do not qualify: discard any model with "
        "score < min_score or non-positive total cost.",
        "Total token cost in dollars: "
        "(input_tokens * input_cost_per_m + output_tokens * output_cost_per_m) / 1_000_000.",
        "Efficiency is score / cost. Select the candidate maximizing efficiency. "
        "To break ties by higher score and preserve first occurrence, "
        "track (efficiency, score) or only update when strictly greater.",
    ],
    "statement": """
Find the **best value model** on an evaluation leaderboard — the model that
maximizes the benchmark quality score per dollar of token cost.

When evaluating AI agents on coding benchmarks like **ProgramBench** or
**SWE-bench**, the top-performing frontier models often achieve slightly higher
accuracy at an exorbitant price. In production engineering, selecting the right
backbone requires optimizing for **return on investment (ROI)**: quality delivered
per dollar spent on API tokens.

Implement `best_value_model(leaderboard, min_score=0.0)`.

Each entry in `leaderboard` is a dictionary describing a model evaluated on the
benchmark:

```python
{
    "name": "Claude 3.5 Sonnet",
    "score": 40.0,             # benchmark solve rate (% or points, >= 0)
    "input_tokens": 12_500_000, # prompt tokens used across the benchmark
    "output_tokens": 1_200_000, # generated tokens across the benchmark
    "input_cost_per_m": 3.0,    # USD per 1,000,000 input tokens
    "output_cost_per_m": 15.0,  # USD per 1,000,000 output tokens
}
```

The total cost in USD to run the model across the benchmark is:

```
        input_tokens * input_cost_per_m + output_tokens * output_cost_per_m
cost = -------------------------------------------------------------------
                                    1,000,000
```

The model's **cost efficiency** (quality points per dollar) is:

```
efficiency = score / cost
```

### Rules

1. **Filtering:** A model is eligible only if `cost > 0` and `score >= min_score`.
   Models that do not meet both conditions are ignored.
2. **Best model:** Pick the candidate with the highest `efficiency`.
3. **Tie-breaking:** If multiple candidates achieve the exact same efficiency,
   prefer the one with the higher benchmark `score`. If scores are also tied,
   pick the one that appears earlier in `leaderboard`.
4. **Empty or no candidates:** If `leaderboard` is empty or no model meets the
   criteria, return `None`.
""",
}
