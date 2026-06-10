import pytest

from tools.checks import assert_clean

# Argument specs exercised against the built-in range (the oracle).
SPECS = [
    (10,), (3,), (5,),
    (0, 10, 2), (10, 20), (10, 20, 2), (3, 33, 7),
    (10, 3, -3), (10, 0, -1), (10, 0), (0, 10, -1),
    (3, 0, -1), (3, -10, -3), (-2, -6, -1), (2, -2, -1),
]


@pytest.mark.parametrize("spec", SPECS)
def test_matches_builtin(impl, spec):
    r = range(*spec)
    R = impl.Range(*spec)
    assert len(R) == len(r)
    assert str(R) == str(r)
    assert list(R) == list(r)
    for i in list(range(len(r))) + list(range(-len(r), 0)):
        assert R[i] == r[i]


def test_reiterable(impl):
    R = impl.Range(3)
    assert sum(1 for _ in R) == 3
    assert sum(1 for _ in R) == 3  # a fresh iterator each time


def test_index_error(impl):
    with pytest.raises(IndexError):
        impl.Range(10, 20, 2)[5]
    with pytest.raises(IndexError):
        impl.Range(5)[-6]


def test_step_zero(impl):
    with pytest.raises(ValueError):
        impl.Range(0, 10, 0)


def test_stop_iteration(impl):
    it = iter(impl.Range(3))
    with pytest.raises(StopIteration):
        for _ in range(4):
            next(it)


def test_contains(impl):
    R = impl.Range(0, 10, 2)
    assert 4 in R
    assert 5 not in R
    assert 12 not in R
    assert -2 not in R
    R2 = impl.Range(10, 0, -2)
    assert 4 in R2
    assert 5 not in R2
    assert 12 not in R2


def test_contains_is_o1(impl):
    R = impl.Range(0, 1_000_000)
    for _ in range(10000):
        assert 500_000 in R


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
