import numpy as np


def numpy_version() -> str:
    """
    Return the installed NumPy version as a string (e.g. ``"2.1.0"``).

    NumPy exposes this as ``np.__version__``. (For exploring, ``np.show_config()``
    prints the full build configuration — but this function only needs to
    return the version string.)

    :return: the NumPy version string
    """
    # --- solution: begin ---
    return np.__version__
    # --- solution: end ---
