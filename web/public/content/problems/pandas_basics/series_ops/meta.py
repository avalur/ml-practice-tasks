META = {
    "title": "Series Mean and ArgMax",
    "topic": "pandas_basics",
    "difficulty": "easy",
    "entry": "series_mean_and_argmax",
    "order": 1,
    "py_deps": ["pandas"],
    "banned": {},
    "hints": [
        "Create a Series with pd.Series(data), then call .mean() and .idxmax() on it.",
        "pd.Series preserves insertion order, so .idxmax() returns the label of the first maximum when there are ties.",
    ],
    "statement": """
Implement `series_mean_and_argmax(data)`.

`data` is a non-empty dict `{label: numeric_value}`.

Return a tuple `(mean, label_of_max)`:
- `mean` — arithmetic mean of all values as a Python `float`.
- `label_of_max` — the label (key) whose value is the largest.
  When multiple values tie, return the label that appears **first** in `data`.

```python
series_mean_and_argmax({"a": 1, "b": 3, "c": 2})  # → (2.0, 'b')
```
""",
}
