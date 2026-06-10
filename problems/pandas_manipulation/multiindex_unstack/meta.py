META = {
    "title": "MultiIndex: set_index and unstack",
    "topic": "pandas_manipulation",
    "difficulty": "medium",
    "entry": "build_multiindex",
    "order": 3,
    "py_deps": ["pandas"],
    "banned": {"names": ["pivot", "pivot_table"]},
    "hints": [
        "df.set_index(['col1','col2']) turns two columns into a two-level MultiIndex.",
        "df.unstack(level=name) pivots one level of the index into columns, turning long format into wide.",
        "After unstacking, column names become a MultiIndex tuple (original_col, unstacked_value).",
    ],
    "statement": """
Implement two reshaping functions.

**`build_multiindex(df, index_cols)`**
Set `index_cols` as a hierarchical MultiIndex and return the reindexed DataFrame.

**`unstack_level(df, level)`**
Unstack `level` of the MultiIndex, pivoting that index level into column labels.

`pivot` and `pivot_table` are not allowed — use `set_index` + `unstack`.

```python
df = pd.DataFrame({
    "region":["EU","EU","US","US"], "q":["Q1","Q2","Q1","Q2"], "rev":[10,20,30,40]
})
mi = build_multiindex(df, ["region","q"])
unstack_level(mi, "q")
#         rev
# q        Q1  Q2
# region
# EU       10  20
# US       30  40
```
""",
}
