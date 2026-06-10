import pytest
from tools.checks import assert_clean

CASES = [
    ({"a": 1, "b": 3, "c": 2}, 2.0, "b"),
    ({"x": 10}, 10.0, "x"),
    ({"alice": 5, "bob": 5, "charlie": 1}, 11 / 3, "alice"),
    ({"p": 100, "q": 0, "r": 50}, 50.0, "p"),
    ({"jan": 31, "feb": 28, "mar": 31, "apr": 30}, 30.0, "jan"),
    ({"z": -1, "a": -5, "m": -2}, -8 / 3, "z"),
]


def _oracle(data: dict) -> tuple:
    vals = list(data.values())
    mean = sum(vals) / len(vals)
    max_val = max(vals)
    argmax = next(k for k, v in data.items() if v == max_val)
    return float(mean), argmax


@pytest.mark.parametrize("data, exp_mean, exp_argmax", CASES)
def test_series_mean_and_argmax(impl, data, exp_mean, exp_argmax):
    mean, argmax = impl.series_mean_and_argmax(data)
    assert isinstance(mean, float), "mean should be a float"
    assert abs(mean - exp_mean) < 1e-9
    assert argmax == exp_argmax


@pytest.mark.parametrize("data, _, __", CASES)
def test_matches_oracle(impl, data, _, __):
    exp_mean, exp_argmax = _oracle(data)
    got_mean, got_argmax = impl.series_mean_and_argmax(data)
    assert abs(got_mean - exp_mean) < 1e-9
    assert got_argmax == exp_argmax


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
