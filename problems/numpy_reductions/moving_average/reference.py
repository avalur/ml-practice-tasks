import numpy as np


def moving_average(a: np.ndarray, n: int) -> np.ndarray:
    """
    Return the length-``n`` moving average of the 1D array ``a``.

    The result has length ``len(a) - n + 1``; element ``i`` is the mean of
    ``a[i : i + n]``. Vectorize it (no loops) — prefix sums make this O(len(a)).

    :param a: 1D array
    :param n: window length (1 <= n <= len(a))
    :return: 1D array of moving averages, length ``len(a) - n + 1``
    """
    # --- solution: begin ---
    c = np.cumsum(a, dtype=float)
    c[n:] = c[n:] - c[:-n]
    return c[n - 1:] / n
    # --- solution: end ---
