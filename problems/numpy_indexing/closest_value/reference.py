import numpy as np


def closest_value(x: np.ndarray, v: float) -> float:
    """
    Return the element of 1D ``x`` closest to scalar ``v`` (minimizing
    ``|x - v|``). No loops.

    :param x: 1D array
    :param v: scalar
    :return: the element of ``x`` nearest to ``v``
    """
    # --- solution: begin ---
    return x[np.abs(x - v).argmin()]
    # --- solution: end ---
