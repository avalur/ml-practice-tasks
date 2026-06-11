import numpy as np
import numpy.typing as npt


def replace_nans(matrix: npt.NDArray[np.float64]) -> npt.NDArray[np.float64]:
    """
    Return a copy of ``matrix`` with every ``NaN`` replaced by the mean of all
    non-``NaN`` values. If every value is ``NaN`` (or the matrix is empty),
    return zeros of the same shape. Do not modify the input. No ``for``/``while``
    loops.

    :param matrix: a float matrix possibly containing NaNs
    :return: the matrix with NaNs filled in
    """
    result = matrix.copy()
    mask = np.isnan(matrix)
    if mask.all():
        result[mask] = 0.0
    else:
        result[mask] = matrix[~mask].mean()
    return result
