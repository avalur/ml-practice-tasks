import numpy as np


def intersect(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """
    Return the sorted, unique values present in both 1D ``a`` and ``b``. No loops.

    :param a: 1D array
    :param b: 1D array
    :return: sorted unique common values
    """
    return np.intersect1d(a, b)
