import inspect

from tools.checks import assert_clean


def test_is_generator(impl):
    assert inspect.isgenerator(impl.flat_it((1, 2, 3))), "flat_it must be a generator"


def test_already_flat(impl):
    assert list(impl.flat_it((1, 2, 3))) == [1, 2, 3]


def test_nested(impl):
    assert list(impl.flat_it((1, (2, 3), [4, [5, 6], 7]))) == list(range(1, 8))


def test_etalon(impl):
    got = list(impl.flat_it([[1, [[2, [5, [6, [2, "sample"]]]], 3], range(-5, -3, 1)]]))
    assert got == [1, 2, 5, 6, 2, "s", "a", "m", "p", "l", "e", 3, -5, -4]


def test_deeply_nested(impl):
    # 10 * 10**4 = 100000 leaves, nesting depth 4.
    inner = list(range(10))
    size, levels = 10, 4
    huge = inner
    for _ in range(levels):
        huge = [huge for _ in range(size)]
    assert list(impl.flat_it(huge)) == inner * size ** levels


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
