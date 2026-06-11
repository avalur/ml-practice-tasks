import numpy as np
import numpy.typing as npt


def nonzero_product(matrix: npt.NDArray[np.int_]) -> int | None:
    """
    Return the product of the **nonzero** elements on the main diagonal of
    ``matrix``. If every diagonal element is zero (or there is no diagonal),
    return ``None``. No ``for``/``while`` loops.

    :param matrix: a 2D integer array
    :return: product of nonzero diagonal entries, or None
    """
    diagonal = np.diag(matrix)
    nonzero = diagonal[diagonal != 0]
    if nonzero.size == 0:
        return None
    return int(np.prod(nonzero))
