def merge_iterative(lst_a: list[int], lst_b: list[int]) -> list[int]:
    """
    Merge two sorted lists in one sorted list
    :param lst_a: first sorted list
    :param lst_b: second sorted list
    :return: merged sorted list
    """
    result = []
    i_a, i_b = 0, 0
    while i_a < len(lst_a) and i_b < len(lst_b):
        if lst_a[i_a] < lst_b[i_b]:
            result.append(lst_a[i_a])
            i_a += 1
        else:
            result.append(lst_b[i_b])
            i_b += 1
    if i_a < len(lst_a):
        result.extend(lst_a[i_a:])
    elif i_b < len(lst_b):
        result.extend(lst_b[i_b:])
    return result


def merge_sorted(lst_a: list[int], lst_b: list[int]) -> list[int]:
    """
    Merge two sorted lists in one sorted list ising `sorted`
    :param lst_a: first sorted list
    :param lst_b: second sorted list
    :return: merged sorted list
    """
    return sorted(lst_a + lst_b)
