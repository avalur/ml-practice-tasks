import numpy as np


def repeat_counts(counts: np.ndarray) -> np.ndarray:
    """
    Inverse of ``np.bincount``: return a 1D array where index ``i`` appears
    ``counts[i]`` times, in order. No loops.

    :param counts: 1D non-negative integer array
    :return: 1D array of repeated indices
    """
    return np.repeat(np.arange(len(counts)), counts)
