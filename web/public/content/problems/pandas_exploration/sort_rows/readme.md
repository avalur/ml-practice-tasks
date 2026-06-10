# Multi-Column Sort

**Topic:** `pandas_exploration` &nbsp;|&nbsp; **Difficulty:** easy

Implement `sort_by_surname_age(df)`.

`df` has columns `'name'`, `'surname'`, `'age'`. Sort by two keys:
1. **`surname`** — descending (Z → A)
2. **`age`** — ascending (younger first) among rows sharing the same surname

Keep the original index; do not reset it.

```python
# surname "Smith" > "Brown", so Smiths come first
# among Smiths: Carol (age 20) before Alice (age 30)
sort_by_surname_age(df)
# Carol  Smith 20
# Alice  Smith 30
# Bob    Brown 25
```

## How to run

```bash
pytest tasks/pandas_exploration/sort_rows
```
Edit `submission.py` until every test passes.
