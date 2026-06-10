import pandas as pd
import pytest
from pandas.testing import assert_frame_equal
from tools.checks import assert_clean

DF = pd.DataFrame({
    "name":    ["Adam", "Brian", "Christos", "Dolly", "Elena", "Demetra", "Brian"],
    "surname": ["Brown", "Smith", "Andreou", "Kuang", "Blake", "Andreou", "Smith"],
    "age":     [23, 45, 12, 22, 73, 34, 45],
})


def _oracle(df, max_age, starts, excl):
    rows = [
        row for _, row in df.iterrows()
        if row["age"] <= max_age
        and any(row["name"].startswith(p) for p in starts)
        and row["surname"] != excl
    ]
    if not rows:
        return df.iloc[0:0]
    return pd.DataFrame(rows)


@pytest.mark.parametrize("max_age, starts, excl", [
    (60, ("A", "D"), "Brown"),
    (30, ("A", "D", "C"), "Andreou"),
    (100, ("B",), "Jones"),
    (25, ("A", "D"), "Kuang"),
    (10, ("A",), "Brown"),
])
def test_filter_matches_oracle(impl, max_age, starts, excl):
    result = impl.filter_rows(DF, max_age, starts, excl)
    expected = _oracle(DF, max_age, starts, excl)
    assert_frame_equal(
        result.reset_index(drop=True),
        expected.reset_index(drop=True),
    )


def test_original_not_mutated(impl):
    original_len = len(DF)
    impl.filter_rows(DF, 60, ("A", "D"), "Brown")
    assert len(DF) == original_len


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
