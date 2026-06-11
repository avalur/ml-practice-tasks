import numpy as np


def sort_by_column(X: np.ndarray, k: int) -> np.ndarray:
    """
    Return ``X`` with rows reordered so column ``k`` is ascending.

    Use ``argsort`` on the column, then index the rows with it. No loops.

    :param X: 2D array
    :param k: column index to sort by
    :return: row-reordered array of the same shape
    """
    return X[X[:, k].argsort()]
