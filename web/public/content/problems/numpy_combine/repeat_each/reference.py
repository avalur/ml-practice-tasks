import numpy as np


def repeat_each(x: np.ndarray, k: int) -> np.ndarray:
    """
    Repeat **each element** of the 1D array ``x`` ``k`` times consecutively,
    producing a 1D array of length ``k * len(x)``.

    For example, ``repeat_each([1, 2, 3], 2)`` returns ``[1, 1, 2, 2, 3, 3]``
    (contrast with tiling the whole array, which would give
    ``[1, 2, 3, 1, 2, 3]``).

    :param x: 1D array
    :param k: number of times to repeat each element
    :return: 1D array of length k * len(x)
    """
    return np.repeat(x, k)
