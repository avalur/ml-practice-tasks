import numpy as np


def rgba_dtype() -> np.dtype:
    """
    Return a structured NumPy ``dtype`` describing a color as four unsigned
    bytes: fields ``"r"``, ``"g"``, ``"b"``, ``"a"``, each an ``np.uint8``
    (one unsigned byte). The dtype occupies 4 bytes in total.

    :return: the custom RGBA dtype
    """
    return np.dtype([("r", np.uint8), ("g", np.uint8), ("b", np.uint8), ("a", np.uint8)])
