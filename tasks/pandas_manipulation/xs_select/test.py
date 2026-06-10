import pandas as pd
import pytest
from pandas.testing import assert_frame_equal
from tools.checks import assert_clean

# Build a DataFrame with a 2-level column MultiIndex (metric, year)
_data = {
    "City":     ["London", "London", "NY", "NY"],
    "Category": ["Elec", "Cloth", "Elec", "Cloth"],
    "Sales_2021": [5000, 3000, 6000, 4000],
    "Sales_2022": [7000, 2000, 7000, 5000],
    "Offers_2021": [50, 40, 70, 30],
    "Offers_2022": [70, 20, 10, 40],
}
_flat = pd.DataFrame(_data).set_index(["City", "Category"])
MI_COLS = pd.MultiIndex.from_tuples(
    [("Sales", 2021), ("Sales", 2022), ("Offers", 2021), ("Offers", 2022)],
    names=["metric", "year"],
)
DF_MI = _flat.copy()
DF_MI.columns = MI_COLS


def test_xs_selects_year_2022(impl):
    result = impl.xs_by_level(DF_MI, 2022, level="year")
    assert list(result.columns) == ["Sales", "Offers"]
    assert result.loc[("London", "Elec"), "Sales"] == 7000
    assert result.loc[("NY", "Cloth"), "Offers"] == 40


def test_xs_selects_year_2021(impl):
    result = impl.xs_by_level(DF_MI, 2021, level="year")
    assert list(result.columns) == ["Sales", "Offers"]
    assert result.loc[("London", "Cloth"), "Sales"] == 3000


def test_xs_selects_metric(impl):
    result = impl.xs_by_level(DF_MI, "Sales", level="metric")
    assert list(result.columns) == [2021, 2022]
    assert result.loc[("NY", "Elec"), 2022] == 7000


def test_swaplevel_select_2022(impl):
    result = impl.swaplevel_select(DF_MI, 2022)
    assert list(result.columns) == ["Sales", "Offers"]
    assert result.loc[("London", "Elec"), "Sales"] == 7000


def test_swaplevel_select_2021(impl):
    result = impl.swaplevel_select(DF_MI, 2021)
    assert list(result.columns) == ["Sales", "Offers"]


def test_xs_and_swaplevel_agree(impl):
    xs_result = impl.xs_by_level(DF_MI, 2022, level="year")
    swap_result = impl.swaplevel_select(DF_MI, 2022)
    assert_frame_equal(xs_result, swap_result)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
