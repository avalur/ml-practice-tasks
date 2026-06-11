import numpy as np


def stack_columns(arrays: list) -> np.ndarray:
    """
    Stack a list of equal-length 1D arrays as the **columns** of a 2D array.
    With ``k`` arrays each of length ``n``, the result has shape ``(n, k)``
    and column ``j`` equals ``arrays[j]``.

    This is how you assemble feature columns into a design matrix.

    :param arrays: list of 1D arrays, all the same length
    :return: 2D array of shape (n, k)
    """
    return np.column_stack(arrays)
