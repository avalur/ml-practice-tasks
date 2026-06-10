import pandas as pd
import pytest
from pandas.testing import assert_frame_equal, assert_index_equal
from tools.checks import assert_clean

FLAT = pd.DataFrame({
    "product": ["A", "A", "A", "B", "B", "B"],
    "city":    ["London", "NY", "Tokyo"] * 2,
    "year":    [2022] * 3 + [2023] * 3,
    "sales":   [100, 150, 200, 120, 170, 220],
})

FLAT2 = pd.DataFrame({
    "region": ["EU", "EU", "US", "US"],
    "q":      ["Q1", "Q2", "Q1", "Q2"],
    "rev":    [10, 20, 30, 40],
})


def test_build_multiindex_shape(impl):
    result = impl.build_multiindex(FLAT, ["product", "city"])
    assert result.index.nlevels == 2
    assert result.index.names == ["product", "city"]
    assert "product" not in result.columns
    assert "city" not in result.columns


def test_build_multiindex_values(impl):
    result = impl.build_multiindex(FLAT2, ["region", "q"])
    expected = FLAT2.set_index(["region", "q"])
    assert_frame_equal(result, expected)


def test_unstack_shape(impl):
    mi = impl.build_multiindex(FLAT2, ["region", "q"])
    result = impl.unstack_level(mi, "q")
    assert "Q1" in result["rev"].columns
    assert "Q2" in result["rev"].columns
    assert result.shape == (2, 2)


def test_unstack_q(impl):
    mi = impl.build_multiindex(FLAT2, ["region", "q"])
    result = impl.unstack_level(mi, "q")
    assert ("rev", "Q1") in result.columns
    assert ("rev", "Q2") in result.columns


def test_unstack_preserves_values(impl):
    mi = impl.build_multiindex(FLAT2, ["region", "q"])
    unstacked = impl.unstack_level(mi, "q")
    assert unstacked.loc["EU", ("rev", "Q1")] == 10
    assert unstacked.loc["US", ("rev", "Q2")] == 40


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
