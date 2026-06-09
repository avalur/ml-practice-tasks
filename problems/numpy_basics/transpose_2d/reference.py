import numpy as np


def transpose_2d(X: np.ndarray) -> np.ndarray:
    """
    Return the transpose of the 2D array ``X``: an array whose element at
    ``(j, i)`` equals ``X[i, j]``. A ``(m, n)`` array becomes ``(n, m)``.

    :param X: 2D array, shape (m, n)
    :return: transpose of ``X``, shape (n, m)
    """
    # --- solution: begin ---
    return X.T
    # --- solution: end ---
