import numpy as np


def one_hot(labels: np.ndarray, k: int) -> np.ndarray:
    """
    One-hot encode integer ``labels`` (values in ``[0, k)``) into a
    ``(len(labels), k)`` array.

    Row ``i`` has ``1.0`` at column ``labels[i]`` and ``0.0`` elsewhere.
    Vectorize it (no loops).

    :param labels: 1D integer array, values in [0, k)
    :param k: number of classes (columns)
    :return: (len(labels), k) one-hot array
    """
    raise NotImplementedError("Your code here")
