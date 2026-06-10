import numpy as np
import numpy.typing as npt


def add_zeros(x: npt.NDArray[np.int_]) -> npt.NDArray[np.int_]:
    """
    Insert a single zero between every pair of adjacent elements of the 1D
    array ``x``. For example ``[1, 2, 3]`` becomes ``[1, 0, 2, 0, 3]``. An array
    with fewer than two elements is returned unchanged. No ``for``/``while``
    loops.

    :param x: 1D integer array
    :return: array with zeros interleaved (length ``2*len(x) - 1``, or 0)
    """
    # --- solution: begin ---
    if x.size == 0:
        return x.copy()
    out = np.zeros(2 * x.size - 1, dtype=x.dtype)
    out[::2] = x
    return out
    # --- solution: end ---
