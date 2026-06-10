META = {
    "title": "MultiIndex Selection: xs() and swaplevel()",
    "topic": "pandas_manipulation",
    "difficulty": "medium",
    "entry": "xs_by_level",
    "order": 4,
    "py_deps": ["pandas"],
    "banned": {},
    "hints": [
        "df.xs(key, axis=1, level='year') returns all columns where the 'year' level equals key.",
        "df.swaplevel(axis=1) swaps the two column-MultiIndex levels; then df[key] selects by the new level 0.",
        "Both approaches return a DataFrame with a flat (non-multi) column index.",
    ],
    "statement": """
Given a DataFrame with a **2-level column MultiIndex** `(metric, year)`,
implement two selection functions.

**`xs_by_level(df, key, level)`**
Return the cross-section where the MultiIndex `level` equals `key`,
using `df.xs(key, axis=1, level=level)`.

**`swaplevel_select(df, key)`**
Swap the two column levels with `swaplevel(axis=1)` and then index by `key`
to select all columns whose **original** level-1 value equals `key`.

Both functions must return the same result when called with the same `key`.

```python
# df.columns is MultiIndex: (metric, year) e.g. ("Sales",2022), ("Offers",2022)
xs_by_level(df, 2022, level="year")
# Returns DataFrame with columns ["Sales","Offers"] (the 2022 slice)
```
""",
}
