import numpy as np


def to_binary(x: np.ndarray, bits: int) -> np.ndarray:
    """
    Return the ``(len(x), bits)`` binary representation of non-negative integers
    ``x`` (most significant bit first). No loops.

    :param x: 1D array of non-negative integers
    :param bits: number of bit columns
    :return: (len(x), bits) array of 0/1
    """
    masks = 1 << np.arange(bits)[::-1]
    return ((x.reshape(-1, 1) & masks) > 0).astype(int)
