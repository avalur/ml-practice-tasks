import numpy as np


def swap_rows(X: np.ndarray, i: int, j: int) -> np.ndarray:
    """
    Return a copy of 2D ``X`` with rows ``i`` and ``j`` swapped. ``X`` itself
    must not be modified. No loops.

    :param X: 2D array
    :param i: first row index
    :param j: second row index
    :return: copy of X with rows i and j swapped
    """
    # --- solution: begin ---
    out = X.copy()
    out[[i, j]] = out[[j, i]]
    return out
    # --- solution: end ---
