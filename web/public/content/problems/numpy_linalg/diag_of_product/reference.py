import numpy as np


def diag_of_product(A: np.ndarray, B: np.ndarray) -> np.ndarray:
    """
    Return the diagonal of ``A @ B`` (``A`` is ``(n, k)``, ``B`` is ``(k, n)``)
    as a length-``n`` array, without forming the full product. No loops.

    :param A: array of shape (n, k)
    :param B: array of shape (k, n)
    :return: 1D array of length n, the diagonal of A @ B
    """
    return np.einsum("ij,ji->i", A, B)
