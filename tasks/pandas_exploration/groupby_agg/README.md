# GroupBy Aggregation: Sum and Mean

**Topic:** `pandas_exploration` &nbsp;|&nbsp; **Difficulty:** medium

Implement two aggregation functions.

**`total_per_group(df, group_col, value_col)`**
Return the **sum** of `value_col` for each group in `group_col` as a `pd.Series`.

**`mean_per_group(df, group_col, value_col)`**
Return the **mean** of `value_col` for each group in `group_col` as a `pd.Series`.

`.apply()` is not allowed — use `groupby().sum()` / `groupby().mean()` directly.

```python
df = pd.DataFrame({
    "city": ["London","London","NY","NY","Tokyo"],
    "sales": [7000, 2000, 7000, 5000, 5000],
})
total_per_group(df, "city", "sales")
# city
# London    9000
# NY       12000
# Tokyo     5000
# Name: sales, dtype: int64
```

## Constraints

- Forbidden functions: apply

## How to run

```bash
pytest tasks/pandas_exploration/groupby_agg
```
Edit `submission.py` until every test passes.
