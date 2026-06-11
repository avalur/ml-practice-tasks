import numpy as np


def gram_matrix(X: np.ndarray) -> np.ndarray:
    """
    Return the ``(m, m)`` Gram matrix of the rows of ``X`` (shape ``(m, n)``):
    ``G[i, j] = X[i] . X[j]``. No loops.

    :param X: 2D array of shape (m, n)
    :return: (m, m) Gram matrix
    """
    return X @ X.T
