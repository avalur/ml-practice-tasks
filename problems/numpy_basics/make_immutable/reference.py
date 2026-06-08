import numpy as np


def make_immutable(a: np.ndarray) -> np.ndarray:
    """
    Return the array ``a`` made read-only: its values are unchanged, but any
    attempt to assign into the result (e.g. ``result[0] = 1``) must raise.

    NumPy arrays expose a ``flags.writeable`` flag for exactly this.

    :param a: any NumPy array
    :return: the same data, now read-only
    """
    # --- solution: begin ---
    a.flags.writeable = False
    return a
    # --- solution: end ---
