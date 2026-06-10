META = {
    "title": "GroupBy Aggregation: Sum and Mean",
    "topic": "pandas_exploration",
    "difficulty": "medium",
    "entry": "total_per_group",
    "order": 3,
    "py_deps": ["pandas"],
    "banned": {"names": ["apply"]},
    "hints": [
        "df.groupby(col)[value_col] selects the value column within each group.",
        "Chain .sum() or .mean() directly on the GroupBy object — no need for .apply().",
        "The result is a Series indexed by the group values.",
    ],
    "statement": """
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
""",
}
