META = {
    "title": "Multi-Column Sort",
    "topic": "pandas_exploration",
    "difficulty": "easy",
    "entry": "sort_by_surname_age",
    "order": 2,
    "py_deps": ["pandas"],
    "banned": {},
    "hints": [
        "df.sort_values(by=[...], ascending=[...]) accepts a list of column names and a matching list of booleans.",
        "ascending=[False, True] means first column descending, second column ascending.",
    ],
    "statement": """
Implement `sort_by_surname_age(df)`.

`df` has columns `'name'`, `'surname'`, `'age'`. Sort by two keys:
1. **`surname`** — descending (Z → A)
2. **`age`** — ascending (younger first) among rows sharing the same surname

Keep the original index; do not reset it.

```python
# surname "Smith" > "Brown", so Smiths come first
# among Smiths: Carol (age 20) before Alice (age 30)
sort_by_surname_age(df)
# Carol  Smith 20
# Alice  Smith 30
# Bob    Brown 25
```
""",
}
