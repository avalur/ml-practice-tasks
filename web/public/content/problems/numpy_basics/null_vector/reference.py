import numpy as np


def null_vector(n: int) -> np.ndarray:
    """
    Return a 1D array of ``n`` zeros (a "null vector") of dtype float.

    :param n: length of the vector (``n >= 0``)
    :return: array of n zeros
    """
    return np.zeros(n)
