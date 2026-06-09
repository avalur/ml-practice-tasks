import numpy as np


def split_equal(x: np.ndarray, n: int) -> list:
    """
    Split the 1D array ``x`` into ``n`` equal-length contiguous parts and
    return them as a list of ``n`` arrays. ``len(x)`` is divisible by ``n``.

    For example, ``split_equal([1, 2, 3, 4, 5, 6], 3)`` returns
    ``[[1, 2], [3, 4], [5, 6]]``.

    :param x: 1D array whose length is divisible by ``n``
    :param n: number of parts
    :return: list of ``n`` contiguous sub-arrays
    """
    # --- solution: begin ---
    return list(np.split(x, n))
    # --- solution: end ---
