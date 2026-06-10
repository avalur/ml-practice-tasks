import pandas as pd
import pytest
from tools.checks import assert_clean

DF = pd.DataFrame({
    "name":    ["Adam", "Brian", "Christos", "Dolly", "Elena", "Dolly2", "Brian2"],
    "surname": ["Brown", "Smith", "Andreou", "Brown", "Blake", "Andreou", "Smith"],
    "age":     [23, 45, 12, 22, 73, 34, 45],
})

EXTRA_CASES = [
    pd.DataFrame({
        "name":    ["Alice", "Bob", "Carol", "Dave"],
        "surname": ["Smith", "Brown", "Smith", "Andreou"],
        "age":     [30, 25, 20, 40],
    }),
    pd.DataFrame({
        "name":    ["X"],
        "surname": ["Only"],
        "age":     [5],
    }),
]


def _is_sorted_correctly(df_sorted):
    surnames = list(df_sorted["surname"])
    ages = list(df_sorted["age"])
    for i in range(len(surnames) - 1):
        if surnames[i] < surnames[i + 1]:
            return False, f"row {i}: surname '{surnames[i]}' should come before '{surnames[i+1]}' (descending)"
        if surnames[i] == surnames[i + 1] and ages[i] > ages[i + 1]:
            return False, f"row {i}: same surname, age {ages[i]} > {ages[i+1]} (should be ascending)"
    return True, ""


def test_sort_invariants(impl):
    result = impl.sort_by_surname_age(DF)
    ok, msg = _is_sorted_correctly(result)
    assert ok, msg


def test_sort_same_rows(impl):
    result = impl.sort_by_surname_age(DF)
    assert set(result["name"]) == set(DF["name"])
    assert len(result) == len(DF)


@pytest.mark.parametrize("df", EXTRA_CASES)
def test_sort_extra(impl, df):
    result = impl.sort_by_surname_age(df)
    ok, msg = _is_sorted_correctly(result)
    assert ok, msg
    assert len(result) == len(df)


def test_original_not_mutated(impl):
    original_order = list(DF["name"])
    impl.sort_by_surname_age(DF)
    assert list(DF["name"]) == original_order


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
