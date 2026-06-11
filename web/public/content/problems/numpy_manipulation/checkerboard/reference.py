import numpy as np


def checkerboard(n: int) -> np.ndarray:
    """
    Return an ``(n, n)`` 0/1 checkerboard with ``[0, 0] == 0`` (cell ``[i, j]``
    equals ``(i + j) % 2``). Use slicing, no loops.

    :param n: side length
    :return: (n, n) int array
    """
    Z = np.zeros((n, n), dtype=int)
    Z[1::2, ::2] = 1
    Z[::2, 1::2] = 1
    return Z
