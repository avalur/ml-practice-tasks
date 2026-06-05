import numpy as np


def interleave_zeros(z: np.ndarray, nz: int) -> np.ndarray:
    """
    Insert ``nz`` zeros between consecutive elements of 1D ``z``. Result length
    is ``len(z) + (len(z) - 1) * nz``. No loops.

    :param z: 1D array
    :param nz: number of zeros to insert between elements
    :return: the spaced-out 1D array
    """
    raise NotImplementedError("Your code here")
