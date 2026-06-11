import numpy as np


def matrix_product(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """
    Return the matrix product of ``a`` (shape ``(m, k)``) and ``b`` (shape
    ``(k, n)``) — the real matrix product, shape ``(m, n)``.

    :param a: left matrix, shape (m, k)
    :param b: right matrix, shape (k, n)
    :return: ``a @ b``, shape (m, n)
    """
    return a @ b
