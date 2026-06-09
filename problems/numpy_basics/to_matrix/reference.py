import numpy as np


def to_matrix(x: np.ndarray, rows: int) -> np.ndarray:
    """
    Reshape the 1D array ``x`` into a 2D array with ``rows`` rows, letting
    NumPy infer the number of columns. ``len(x)`` is divisible by ``rows``.

    Use ``-1`` for the column count so NumPy computes it for you.

    :param x: 1D array whose length is divisible by ``rows``
    :param rows: number of rows of the result
    :return: 2D array of shape ``(rows, len(x) // rows)``
    """
    # --- solution: begin ---
    return x.reshape(rows, -1)
    # --- solution: end ---
