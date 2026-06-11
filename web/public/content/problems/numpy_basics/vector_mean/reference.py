import numpy as np


def vector_mean(x: np.ndarray) -> float:
    """
    Return the arithmetic mean (average) of the 1D array ``x``.

    :param x: 1D array (non-empty)
    :return: the mean of its elements
    """
    return x.mean()
