import numpy as np


def solve_system(A: np.ndarray, b: np.ndarray) -> np.ndarray:
    """
    Solve the linear system ``A @ x = b`` for ``x`` (``A`` is ``(n, n)`` and
    invertible, ``b`` has length ``n``). No loops.

    :param A: square invertible matrix of shape (n, n)
    :param b: right-hand side vector of length n
    :return: solution vector x of length n
    """
    raise NotImplementedError("Your code here")
