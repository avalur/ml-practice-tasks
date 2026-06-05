import numpy as np


def mask_negate(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    """
    Return a copy of 1D ``x`` with every element strictly between ``lo`` and
    ``hi`` negated. ``x`` itself must not be modified. Use a boolean mask, no
    loops.

    :param x: 1D array
    :param lo: lower bound (exclusive)
    :param hi: upper bound (exclusive)
    :return: copy of ``x`` with in-range elements negated
    """
    # --- solution: begin ---
    out = x.copy()
    out[(out > lo) & (out < hi)] *= -1
    return out
    # --- solution: end ---
