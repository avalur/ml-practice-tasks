def filter_list_by_list(lst_a: list[int] | range, lst_b: list[int] | range) -> list[int]:
    """
    Both ``lst_a`` and ``lst_b`` are sorted in non-decreasing order. Return a
    new list with every element of ``lst_a`` that does **not** appear in
    ``lst_b`` (preserving order and duplicates). Do not modify the inputs.

    ``set`` is off-limits — exploit the fact that both lists are sorted and walk
    them with two pointers in O(len(a) + len(b)).

    :param lst_a: first sorted sequence
    :param lst_b: second sorted sequence
    :return: elements of ``lst_a`` absent from ``lst_b``
    """
    result: list[int] = []
    j = 0
    m = len(lst_b)
    for x in lst_a:
        while j < m and lst_b[j] < x:
            j += 1
        if j < m and lst_b[j] == x:
            continue
        result.append(x)
    return result
