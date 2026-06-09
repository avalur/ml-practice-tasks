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
    raise NotImplementedError("Your code here")
