import numpy as np


def accumulate_at(values: np.ndarray, idx: np.ndarray, n: int) -> np.ndarray:
    """
    Scatter-add: return a length-``n`` array where entry ``k`` is the sum of
    ``values[j]`` over all ``j`` with ``idx[j] == k``. No loops.

    :param values: 1D array of values
    :param idx: 1D integer array (same length), values in [0, n)
    :param n: output length
    :return: 1D array of length n with the per-index sums
    """
    return np.bincount(idx, weights=values, minlength=n)
