import numpy as np


def most_frequent(x: np.ndarray) -> int:
    """
    Return the most frequent value in 1D non-negative integer array ``x``
    (smallest value on ties). No loops.

    :param x: 1D array of non-negative integers
    :return: the most frequent value
    """
    # --- solution: begin ---
    return np.bincount(x).argmax()
    # --- solution: end ---
