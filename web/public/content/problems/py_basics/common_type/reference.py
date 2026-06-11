def get_common_type(type1: type, type2: type) -> type:
    """
    Given two of the types ``bool, int, float, complex, list, range, tuple,
    str``, return the most specific type that **both** values can be converted
    to (so that ``result(value1)`` and ``result(value2)`` both succeed and make
    sense).

    The rules form two ladders of increasing generality:

    * numbers: ``bool`` → ``int`` → ``float`` → ``complex``
    * sequences: ``range`` → ``tuple`` → ``list``

    Within one ladder, pick the more general of the two. Mixing a number with a
    sequence — or anything with ``str`` — falls back to ``str``. (``range`` is
    never a common type: you cannot build a ``range`` from arbitrary elements,
    so two ranges share ``tuple``.)

    :param type1: first type
    :param type2: second type
    :return: the common type
    """
    numeric = (bool, int, float, complex)   # increasing generality
    sequence = (range, tuple, list)
    if type1 in numeric and type2 in numeric:
        return type1 if numeric.index(type1) >= numeric.index(type2) else type2
    if type1 in sequence and type2 in sequence:
        return list if (type1 is list or type2 is list) else tuple
    if type1 is type2:
        return type1
    return str
