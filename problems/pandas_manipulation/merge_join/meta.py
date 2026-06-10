META = {
    "title": "Inner Merge of Two DataFrames",
    "topic": "pandas_manipulation",
    "difficulty": "easy",
    "entry": "inner_merge",
    "order": 1,
    "py_deps": ["pandas"],
    "banned": {},
    "hints": [
        "pd.merge(left, right, on=key, how='inner') performs an SQL-style inner join.",
        "Rows whose key value has no match in the other DataFrame are dropped.",
        "When one side has multiple rows with the same key, every combination is included (Cartesian product within that key).",
    ],
    "statement": """
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
""",
}
