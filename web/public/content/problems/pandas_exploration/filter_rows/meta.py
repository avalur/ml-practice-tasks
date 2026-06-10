META = {
    "title": "Filter Rows with Boolean Indexing",
    "topic": "pandas_exploration",
    "difficulty": "easy",
    "entry": "filter_rows",
    "order": 1,
    "py_deps": ["pandas"],
    "banned": {"names": ["query"]},
    "hints": [
        "Build a boolean mask for each condition separately, then combine with & (AND) and ~ (NOT).",
        "df['name'].str.startswith(tuple_of_prefixes) returns True for names beginning with any of those prefixes.",
        "df[mask] returns only the rows where mask is True.",
    ],
    "statement": """
Implement `filter_rows(df, max_age, name_starts, excl_surname)`.

`df` has columns `'name'`, `'surname'`, `'age'`. Return only the rows where
**all three** conditions hold:

1. `age <= max_age`
2. `name` starts with one of the prefixes in `name_starts`
3. `surname != excl_surname`

Use **boolean indexing** — `.query()` is not allowed.
Keep the original index labels (no reset).

```python
filter_rows(df, max_age=60, name_starts=("A","D"), excl_surname="Brown")
```
""",
}
