import numpy as np


def concat_arrays(arrays: list) -> np.ndarray:
    """
    Concatenate a list of 1D arrays end to end into a single 1D array, in the
    given order.

    For example, ``[[1, 2], [3], [4, 5]]`` becomes ``[1, 2, 3, 4, 5]``.

    :param arrays: list of 1D arrays
    :return: their end-to-end concatenation, a 1D array
    """
    # --- solution: begin ---
    return np.concatenate(arrays)
    # --- solution: end ---
