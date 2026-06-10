META = {
    "title": "Data Cleaning: Dedup, Fill, Cast",
    "topic": "pandas_manipulation",
    "difficulty": "medium",
    "entry": "drop_dup_ids",
    "order": 2,
    "py_deps": ["pandas"],
    "banned": {},
    "hints": [
        "drop_duplicates(subset=col) keeps the first occurrence of each unique value in col.",
        "fillna(series.mean()) replaces NaN with the mean computed from non-missing values.",
        "astype(float) converts the whole column — strings like '5.7' become 5.7.",
        "Always work on a copy (df.copy()) to avoid mutating the caller's data.",
    ],
    "statement": """
A common data-cleaning pipeline: remove duplicates, fill missing values,
fix type inconsistencies.  Implement three functions.

**`drop_dup_ids(df, id_col)`**
Remove duplicate rows based on `id_col`, keeping the **first** occurrence.

**`fill_mean(df, col)`**
Return a copy of `df` with `NaN` in `col` replaced by the column's mean.

**`cast_col(df, col, dtype)`**
Return a copy of `df` with `col` cast to `dtype` (e.g. `float`).

None of the three functions should mutate the input DataFrame.
""",
}
