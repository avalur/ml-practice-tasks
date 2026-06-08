import numpy as np


def rgba_dtype() -> np.dtype:
    """
    Return a structured NumPy ``dtype`` describing a color as four unsigned
    bytes: fields ``"r"``, ``"g"``, ``"b"``, ``"a"``, each an ``np.uint8``
    (one unsigned byte). The dtype occupies 4 bytes in total.

    :return: the custom RGBA dtype
    """
    raise NotImplementedError("Your code here")
