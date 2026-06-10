def revert(dct: dict[str, str]) -> dict[str, list[str]]:
    """
    Invert a ``{key: value}`` mapping into ``{value: [keys...]}``: every value
    becomes a key whose list holds all original keys that mapped to it. Do not
    modify the input. This must run in O(n) (a single pass), not O(n^2).

    The order of keys inside each list is unspecified.

    :param dct: mapping ``{key: value}``
    :return: inverted mapping ``{value: [key, ...]}``
    """
    raise NotImplementedError("Your code here")
