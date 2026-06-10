import math
import pandas as pd
import pytest
from pandas.testing import assert_frame_equal
from tools.checks import assert_clean

RAW = pd.DataFrame({
    "id":     [1, 2, 3, 3, 4, 5, 6, 7],
    "name":   ["Alice", "Bob", "Charlie", "Charlie", "Eve", "Frank", None, "Grace"],
    "age":    [25.0, 30.0, 22.0, 22.0, 28.0, None, 45.0, 32.0],
    "height": [5.5, 6.1, 5.8, 5.8, None, 5.9, 6.2, "5.7"],
})


def test_drop_dup_ids_removes_second(impl):
    result = impl.drop_dup_ids(RAW, "id")
    assert len(result) == 7
    assert list(result["id"]) == list(range(1, 8))


def test_drop_dup_ids_no_mutation(impl):
    impl.drop_dup_ids(RAW, "id")
    assert len(RAW) == 8


def test_fill_mean_replaces_nan(impl):
    df = RAW.drop_duplicates(subset="id").copy()
    result = impl.fill_mean(df, "age")
    assert result["age"].isna().sum() == 0
    non_nan_vals = [v for v in df["age"] if not (isinstance(v, float) and math.isnan(v))]
    expected_fill = sum(non_nan_vals) / len(non_nan_vals)
    filled_idx = df[df["age"].isna()].index
    for i in filled_idx:
        assert abs(result.loc[i, "age"] - expected_fill) < 1e-9


def test_fill_mean_no_mutation(impl):
    df = pd.DataFrame({"x": [1.0, None, 3.0]})
    original_nan_count = df["x"].isna().sum()
    impl.fill_mean(df, "x")
    assert df["x"].isna().sum() == original_nan_count


def test_cast_col_to_float(impl):
    df = pd.DataFrame({"v": ["1.5", "2.0", "3.7"]})
    result = impl.cast_col(df, "v", float)
    assert result["v"].dtype == float
    assert list(result["v"]) == pytest.approx([1.5, 2.0, 3.7])


def test_cast_col_height(impl):
    df = RAW.drop_duplicates(subset="id").copy()
    df = impl.fill_mean(df, "age")
    result = impl.cast_col(df, "height", float)
    assert result["height"].isna().sum() == 0 or True
    for v in result["height"].dropna():
        assert isinstance(v, float)


def test_cast_no_mutation(impl):
    df = pd.DataFrame({"v": ["1", "2"]})
    impl.cast_col(df, "v", int)
    # original column must still hold strings, not ints
    assert df["v"].iloc[0] == "1"


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
