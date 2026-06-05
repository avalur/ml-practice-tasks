import numpy as np


def reverse_vector(x: np.ndarray) -> np.ndarray:
    """
    Return the 1D array ``x`` with its elements reversed (last element first).

    Use slicing, not loops.

    :param x: 1D array
    :return: reversed array
    """
    # --- solution: begin ---
    return x[::-1]
    # --- solution: end ---
