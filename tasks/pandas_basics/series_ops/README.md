# Series Mean and ArgMax

**Topic:** `pandas_basics` &nbsp;|&nbsp; **Difficulty:** easy

Implement `series_mean_and_argmax(data)`.

`data` is a non-empty dict `{label: numeric_value}`.

Return a tuple `(mean, label_of_max)`:
- `mean` — arithmetic mean of all values as a Python `float`.
- `label_of_max` — the label (key) whose value is the largest.
  When multiple values tie, return the label that appears **first** in `data`.

```python
series_mean_and_argmax({"a": 1, "b": 3, "c": 2})  # → (2.0, 'b')
```

## How to run

```bash
pytest tasks/pandas_basics/series_ops
```
Edit `submission.py` until every test passes.
