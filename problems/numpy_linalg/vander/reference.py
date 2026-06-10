import numpy as np
import numpy.typing as npt


def vander(array: npt.NDArray[np.float64 | np.int_]) -> npt.NDArray[np.float64]:
    """
    Build the Vandermonde matrix of ``array`` with **increasing** powers: the
    element at row ``i``, column ``j`` is ``array[i] ** j``. For a vector of
    length ``n`` the result is ``n x n``.

    ``np.vander`` is off-limits — construct it with broadcasting. No
    ``for``/``while`` loops.

    :param array: 1D numeric array of length n
    :return: the n x n Vandermonde matrix (increasing powers)
    """
    # --- solution: begin ---
    return array[:, None] ** np.arange(array.size)
    # --- solution: end ---
