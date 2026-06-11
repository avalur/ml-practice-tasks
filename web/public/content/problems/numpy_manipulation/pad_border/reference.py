import numpy as np


def pad_border(X: np.ndarray) -> np.ndarray:
    """
    Return ``X`` surrounded by a one-cell border of zeros (shape grows by 2 in
    each dimension). Build it with slicing, not ``np.pad`` and no loops.

    :param X: 2D array of shape (m, n)
    :return: (m + 2, n + 2) array, X in the middle, zeros on the border
    """
    m, n = X.shape
    out = np.zeros((m + 2, n + 2), dtype=X.dtype)
    out[1:-1, 1:-1] = X
    return out
