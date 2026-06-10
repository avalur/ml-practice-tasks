# DataFrame Creation and Columns

**Topic:** `pandas_basics` &nbsp;|&nbsp; **Difficulty:** easy

Implement two functions.

**`make_dataframe(columns)`**
`columns` is a dict `{column_name: [v1, v2, ...]}`. Create and return a
`pd.DataFrame` from it. Column order must match the dict's insertion order.

**`add_product_column(df, col_a, col_b, result)`**
Return a **copy** of `df` with a new column `result = df[col_a] * df[col_b]`.
The original DataFrame must not be modified.

```python
df = make_dataframe({"price": [10, 20], "qty": [3, 5]})
df2 = add_product_column(df, "price", "qty", "total")
# df2["total"] == [30, 100]; df unchanged
```

## How to run

```bash
pytest tasks/pandas_basics/df_columns
```
Edit `submission.py` until every test passes.
