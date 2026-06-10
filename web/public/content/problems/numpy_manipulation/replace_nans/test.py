import numpy as np

from tools.checks import assert_clean

nan = np.nan

CASES = [
    ([[nan, 1, 2, 3], [4, nan, 5, nan]], [[3, 1, 2, 3], [4, 3, 5, 3]]),
    ([[nan, nan], [nan, nan]], [[0, 0], [0, 0]]),
    ([[]], [[]]),
    ([[3]], [[3]]),
    ([[nan]], [[0]]),
    ([[1, nan]], [[1, 1]]),
    ([[0, nan, 2, 3, 4.],
      [5, 6, 7, 8, nan],
      [nan, 11, 12, 13, 14.],
      [15, 16, 17, nan, 19.],
      [20, 21, nan, 23, 24.]],
     [[0, 12, 2, 3, 4.],
      [5, 6, 7, 8, 12.],
      [12, 11, 12, 13, 14.],
      [15, 16, 17, 12, 19.],
      [20, 21, 12, 23, 24.]]),
]


def test_replace_nans(impl):
    for matrix, expected in CASES:
        m = np.array(matrix, dtype=np.float64)
        original = m.copy()
        out = impl.replace_nans(m)
        np.testing.assert_array_equal(out, np.array(expected, dtype=np.float64))
        # input untouched (NaN-aware comparison)
        np.testing.assert_array_equal(np.isnan(m), np.isnan(original))


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
