import numpy as np


def n_largest(x: np.ndarray, n: int) -> np.ndarray:
    """
    Return the ``n`` largest values of 1D ``x``, sorted in descending order.

    Use ``np.argpartition`` to select the top ``n`` (O(len(x))), then sort just
    those. No loops.

    :param x: 1D array
    :param n: how many of the largest to return (1 <= n <= len(x))
    :return: 1D array of the n largest values, descending
    """
    # --- solution: begin ---
    top = x[np.argpartition(-x, n - 1)[:n]]
    return np.sort(top)[::-1]
    # --- solution: end ---
