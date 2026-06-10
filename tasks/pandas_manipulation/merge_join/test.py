import pandas as pd
import pytest
from pandas.testing import assert_frame_equal
from tools.checks import assert_clean


def _oracle_inner_merge(left, right, key):
    result = []
    for _, lr in left.iterrows():
        for _, rr in right.iterrows():
            if lr[key] == rr[key]:
                merged = dict(lr)
                for col, val in rr.items():
                    if col != key:
                        merged[col] = val
                result.append(merged)
    if not result:
        cols = list(left.columns) + [c for c in right.columns if c != key]
        return pd.DataFrame(columns=cols)
    return pd.DataFrame(result)


ORDERS = pd.DataFrame({"id": [1, 2, 3, 4], "item": ["a", "b", "c", "d"]})
PRICES = pd.DataFrame({"id": [1, 3, 5], "price": [10, 30, 50]})

PRODUCTS = pd.DataFrame({"product": ["X", "Y", "Z"], "cat": ["food", "tech", "food"]})
CATS = pd.DataFrame({"cat": ["food", "tech"], "tax": [5, 20]})


def test_basic_merge(impl):
    result = impl.inner_merge(ORDERS, PRICES, "id")
    expected = _oracle_inner_merge(ORDERS, PRICES, "id")
    assert_frame_equal(
        result.sort_values("id").reset_index(drop=True),
        expected.sort_values("id").reset_index(drop=True),
    )


def test_only_common_keys_kept(impl):
    result = impl.inner_merge(ORDERS, PRICES, "id")
    assert set(result["id"]) == {1, 3}


def test_merge_on_string_key(impl):
    result = impl.inner_merge(PRODUCTS, CATS, "cat")
    assert set(result["product"]) == {"X", "Y", "Z"}
    assert "tax" in result.columns


def test_empty_intersection(impl):
    left = pd.DataFrame({"k": [1, 2], "v": ["a", "b"]})
    right = pd.DataFrame({"k": [3, 4], "w": [10, 20]})
    result = impl.inner_merge(left, right, "k")
    assert len(result) == 0


def test_many_to_one(impl):
    left = pd.DataFrame({"k": [1, 1, 2], "x": ["a", "b", "c"]})
    right = pd.DataFrame({"k": [1, 2], "y": [10, 20]})
    result = impl.inner_merge(left, right, "k")
    assert len(result) == 3
    assert list(result[result["k"] == 1]["y"]) == [10, 10]


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
