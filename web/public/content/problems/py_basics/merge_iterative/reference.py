def merge_iterative(lst_a: list[int], lst_b: list[int]) -> list[int]:
    """
    Merge two lists that are already sorted in non-decreasing order into one
    sorted list, **by hand** (the classic merge step of merge sort). Do not
    modify the inputs.

    ``sorted`` and slicing (``seq[a:b]``) are off-limits — walk both lists with
    two pointers in O(len(a) + len(b)).

    :param lst_a: first sorted list
    :param lst_b: second sorted list
    :return: one merged sorted list
    """
    result: list[int] = []
    i = j = 0
    n, m = len(lst_a), len(lst_b)
    while i < n and j < m:
        if lst_a[i] <= lst_b[j]:
            result.append(lst_a[i])
            i += 1
        else:
            result.append(lst_b[j])
            j += 1
    while i < n:
        result.append(lst_a[i])
        i += 1
    while j < m:
        result.append(lst_b[j])
        j += 1
    return result
