# MultiIndex: set_index and unstack

**Topic:** `pandas_manipulation` &nbsp;|&nbsp; **Difficulty:** medium

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

## Constraints

- Forbidden functions: pivot, pivot_table

## How to run

```bash
pytest tasks/pandas_manipulation/multiindex_unstack
```
Edit `submission.py` until every test passes.
