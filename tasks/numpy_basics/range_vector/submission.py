import numpy as np


def range_vector(lo: int, hi: int) -> np.ndarray:
    """
    Return a 1D array of the consecutive integers from ``lo`` up to but not
    including ``hi`` (i.e. ``lo, lo+1, ..., hi-1``).

    Example: ``range_vector(10, 50)`` ranges from 10 to 49.

    :param lo: first value (inclusive)
    :param hi: stop value (exclusive); assume ``hi >= lo``
    :return: the range as an array
    """
    raise NotImplementedError("Your code here")
