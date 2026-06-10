# Filter Rows with Boolean Indexing

**Topic:** `pandas_exploration` &nbsp;|&nbsp; **Difficulty:** easy

Implement `filter_rows(df, max_age, name_starts, excl_surname)`.

`df` has columns `'name'`, `'surname'`, `'age'`. Return only the rows where
**all three** conditions hold:

1. `age <= max_age`
2. `name` starts with one of the prefixes in `name_starts`
3. `surname != excl_surname`

Use **boolean indexing** — `.query()` is not allowed.
Keep the original index labels (no reset).

```python
filter_rows(df, max_age=60, name_starts=("A","D"), excl_surname="Brown")
```

## Constraints

- Forbidden functions: query

## How to run

```bash
pytest tasks/pandas_exploration/filter_rows
```
Edit `submission.py` until every test passes.
