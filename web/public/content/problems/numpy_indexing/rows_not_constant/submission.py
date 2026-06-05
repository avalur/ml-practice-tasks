import numpy as np


def rows_not_constant(X: np.ndarray) -> np.ndarray:
    """
    Return the rows of ``X`` that are not constant (not all values equal),
    in their original order. Use a per-row max/min comparison + a boolean
    mask. No loops.

    :param X: 2D array
    :return: sub-array of the non-constant rows
    """
    raise NotImplementedError("Your code here")
