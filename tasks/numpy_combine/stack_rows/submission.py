import numpy as np


def stack_rows(arrays: list) -> np.ndarray:
    """
    Stack a list of equal-length 1D arrays as the **rows** of a 2D array.
    With ``k`` arrays each of length ``n``, the result has shape ``(k, n)``
    and row ``i`` equals ``arrays[i]``.

    :param arrays: list of 1D arrays, all the same length
    :return: 2D array of shape (k, n)
    """
    raise NotImplementedError("Your code here")
