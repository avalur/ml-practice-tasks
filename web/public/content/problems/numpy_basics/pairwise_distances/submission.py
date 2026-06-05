import numpy as np


def pairwise_distances(x: np.ndarray, y: np.ndarray) -> np.ndarray:
    """
    Compute the matrix of Euclidean distances between two sets of points.

    Given ``x`` of shape ``(n, d)`` and ``y`` of shape ``(m, d)``, return an
    array ``D`` of shape ``(n, m)`` where ``D[i, j]`` is the Euclidean
    distance between ``x[i]`` and ``y[j]``.

    Vectorize the computation: explicit ``for``/``while`` loops and ready-made
    distance helpers (``scipy``, ``sklearn``) are not allowed.

    :param x: array of shape (n, d)
    :param y: array of shape (m, d)
    :return: array of shape (n, m) with pairwise Euclidean distances
    """
    raise NotImplementedError("Your code here")
