import numpy as np


def row_demean(X: np.ndarray) -> np.ndarray:
    """
    Subtract each row's mean from that row.

    Given ``X`` of shape ``(m, n)``, return an array of the same shape where
    row ``i`` is ``X[i] - X[i].mean()``. Vectorize with broadcasting (no loops).

    :param X: 2D array of shape (m, n)
    :return: row-centered array of shape (m, n)
    """
    raise NotImplementedError("Your code here")
