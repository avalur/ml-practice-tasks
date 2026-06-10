import pandas as pd
import pytest
from pandas.testing import assert_series_equal
from tools.checks import assert_clean

DF_SALES = pd.DataFrame({
    "city":     ["London", "London", "NY", "NY", "NY", "Tokyo", "Tokyo"],
    "category": ["Elec", "Cloth", "Elec", "Elec", "Cloth", "Elec", "Cloth"],
    "sales":    [7000, 2000, 7000, 4000, 5000, 5000, 1000],
})


def _oracle_sum(df, group_col, value_col):
    sums = {}
    for _, row in df.iterrows():
        k = row[group_col]
        sums[k] = sums.get(k, 0) + row[value_col]
    s = pd.Series(sums, name=value_col).sort_index()
    s.index.name = group_col
    return s


def _oracle_mean(df, group_col, value_col):
    sums, counts = {}, {}
    for _, row in df.iterrows():
        k = row[group_col]
        sums[k] = sums.get(k, 0) + row[value_col]
        counts[k] = counts.get(k, 0) + 1
    means = {k: sums[k] / counts[k] for k in sums}
    s = pd.Series(means, name=value_col).sort_index()
    s.index.name = group_col
    return s


@pytest.mark.parametrize("group_col, value_col", [
    ("city", "sales"),
    ("category", "sales"),
])
def test_total_per_group(impl, group_col, value_col):
    result = impl.total_per_group(DF_SALES, group_col, value_col)
    expected = _oracle_sum(DF_SALES, group_col, value_col)
    assert_series_equal(result.sort_index(), expected)


@pytest.mark.parametrize("group_col, value_col", [
    ("city", "sales"),
    ("category", "sales"),
])
def test_mean_per_group(impl, group_col, value_col):
    result = impl.mean_per_group(DF_SALES, group_col, value_col)
    expected = _oracle_mean(DF_SALES, group_col, value_col)
    assert_series_equal(result.sort_index(), expected, rtol=1e-9)


def test_single_group(impl):
    df = pd.DataFrame({"g": ["a", "a", "a"], "v": [10, 20, 30]})
    total = impl.total_per_group(df, "g", "v")
    assert total["a"] == 60
    mean = impl.mean_per_group(df, "g", "v")
    assert abs(mean["a"] - 20.0) < 1e-9


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
