import numpy as np


def memory_size(a: np.ndarray) -> int:
    """
    Return the total memory occupied by array ``a``, in bytes.

    The number of bytes is the element count (``a.size``) times the size of one
    element (``a.itemsize``). Compute it from those — don't just read
    ``a.nbytes``.

    :param a: any NumPy array
    :return: total bytes occupied by the array's data
    """
    # --- solution: begin ---
    return a.size * a.itemsize
    # --- solution: end ---
