# Inner Merge of Two DataFrames

**Topic:** `pandas_manipulation` &nbsp;|&nbsp; **Difficulty:** easy

Implement `inner_merge(left, right, key)`.

Return the **inner merge** of `left` and `right` on `key`:
only rows whose `key` value appears in **both** DataFrames are kept.
Use `pd.merge()`.

```python
orders = pd.DataFrame({"id":[1,2,3], "item":["a","b","c"]})
prices = pd.DataFrame({"id":[1,3],   "price":[10,30]})
inner_merge(orders, prices, "id")
#    id item  price
# 0   1    a     10
# 1   3    c     30
```

## How to run

```bash
pytest tasks/pandas_manipulation/merge_join
```
Edit `submission.py` until every test passes.
