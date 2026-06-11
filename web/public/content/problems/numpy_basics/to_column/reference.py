import numpy as np


def to_column(x: np.ndarray) -> np.ndarray:
    """
    Turn the 1D array ``x`` of length ``n`` into a 2D **column vector** of
    shape ``(n, 1)``.

    Note that transposing a 1D array does nothing (``x.T`` is still 1D), so
    you must add a new axis instead.

    :param x: 1D array of length n
    :return: 2D column vector, shape (n, 1)
    """
    return x.reshape(-1, 1)
