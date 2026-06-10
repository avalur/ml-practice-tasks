import numpy as np
import numpy.typing as npt


def nearest_value(matrix: npt.NDArray[np.float64], value: float) -> float | None:
    """
    Return the element of ``matrix`` closest to ``value`` (minimizing
    ``|element - value|``). If ``matrix`` is empty, return ``None``. No
    ``for``/``while`` loops.

    :param matrix: input matrix (any shape)
    :param value: the target value
    :return: the nearest element as a float, or None if empty
    """
    # --- solution: begin ---
    if matrix.size == 0:
        return None
    flat = matrix.ravel()
    return float(flat[np.abs(flat - value).argmin()])
    # --- solution: end ---
