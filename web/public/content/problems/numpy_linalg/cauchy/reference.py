import numpy as np


def cauchy(x: np.ndarray, y: np.ndarray) -> np.ndarray:
    """
    Return the ``(n, m)`` Cauchy matrix ``C[i, j] = 1 / (x[i] - y[j])`` for 1D
    ``x`` (length n) and ``y`` (length m), with all ``x[i] != y[j]``. Use
    broadcasting, no loops.

    :param x: 1D array, length n
    :param y: 1D array, length m
    :return: (n, m) Cauchy matrix
    """
    return 1.0 / np.subtract.outer(x, y)
