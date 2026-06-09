import numpy as np


def tile_rows(x: np.ndarray, r: int) -> np.ndarray:
    """
    Replicate the 1D array ``x`` (length ``n``) ``r`` times to form a 2D
    array of shape ``(r, n)`` whose every row is a copy of ``x``.

    :param x: 1D array of length n
    :param r: number of copies (rows)
    :return: 2D array of shape (r, n), each row equal to ``x``
    """
    # --- solution: begin ---
    return np.tile(x, (r, 1))
    # --- solution: end ---
