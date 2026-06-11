import numpy as np


def trace(X: np.ndarray) -> float:
    """
    Return the trace of square matrix ``X`` (sum of the diagonal). Compute it
    without ``np.trace`` and without loops.

    :param X: square 2D array
    :return: sum of the diagonal entries
    """
    return np.diag(X).sum()
