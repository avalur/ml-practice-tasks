# Label vs Position Indexing: .loc and .iloc

**Topic:** `pandas_basics` &nbsp;|&nbsp; **Difficulty:** easy

Implement two selection functions.

**`loc_select(df, row_labels, col_labels)`**
Return the sub-DataFrame obtained by selecting `row_labels` and `col_labels`
using label-based indexing (`.loc[]`).

**`iloc_select(df, row_positions, col_positions)`**
Return the sub-DataFrame obtained by selecting `row_positions` and
`col_positions` using integer-position indexing (`.iloc[]`).

```python
df = pd.DataFrame({"A":[1,2,3],"B":[4,5,6],"C":[7,8,9]}, index=["r1","r2","r3"])
loc_select(df, ["r1","r3"], ["A","C"])
#    A  C
# r1 1  7
# r3 3  9

iloc_select(df, [0, 2], [0, 2])
#    A  C
# r1 1  7
# r3 3  9
```

## How to run

```bash
pytest tasks/pandas_basics/loc_iloc
```
Edit `submission.py` until every test passes.
