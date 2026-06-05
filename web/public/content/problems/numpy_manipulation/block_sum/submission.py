import numpy as np


def block_sum(X: np.ndarray, b: int) -> np.ndarray:
    """
    Sum ``X`` (shape ``(n, n)``, ``n`` divisible by ``b``) over non-overlapping
    ``b x b`` blocks, returning a ``(n//b, n//b)`` array. Use reshaping, no loops.

    :param X: 2D array of shape (n, n)
    :param b: block size (divides n)
    :return: (n//b, n//b) array of block sums
    """
    raise NotImplementedError("Your code here")
