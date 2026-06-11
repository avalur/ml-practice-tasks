def get_middle_value(a: int, b: int, c: int) -> int:
    """
    Return the middle (median) of the three integers ``a``, ``b``, ``c``.

    You may **not** use ``sorted`` — find the middle with arithmetic / min /
    max instead.

    :param a: first integer
    :param b: second integer
    :param c: third integer
    :return: the value that is neither the smallest nor the largest
    """
    return a + b + c - min(a, b, c) - max(a, b, c)
