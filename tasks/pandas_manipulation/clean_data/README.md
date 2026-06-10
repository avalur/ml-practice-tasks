# Data Cleaning: Dedup, Fill, Cast

**Topic:** `pandas_manipulation` &nbsp;|&nbsp; **Difficulty:** medium

A common data-cleaning pipeline: remove duplicates, fill missing values,
fix type inconsistencies.  Implement three functions.

**`drop_dup_ids(df, id_col)`**
Remove duplicate rows based on `id_col`, keeping the **first** occurrence.

**`fill_mean(df, col)`**
Return a copy of `df` with `NaN` in `col` replaced by the column's mean.

**`cast_col(df, col, dtype)`**
Return a copy of `df` with `col` cast to `dtype` (e.g. `float`).

None of the three functions should mutate the input DataFrame.

## How to run

```bash
pytest tasks/pandas_manipulation/clean_data
```
Edit `submission.py` until every test passes.
