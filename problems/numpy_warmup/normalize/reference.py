import numpy as np


def normalize(x: np.ndarray) -> np.ndarray:
    """
    Z-normalize ``x`` over all elements: ``(x - x.mean()) / x.std()``.

    Vectorize the computation (no loops). Assume the standard deviation is
    non-zero.

    :param x: array of any shape
    :return: array of the same shape, zero mean and unit std overall
    """
    # --- solution: begin ---
    return (x - x.mean()) / x.std()
    # --- solution: end ---
