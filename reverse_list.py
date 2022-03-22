def reverse_iterative(lst: list[int]) -> list[int]:
    """
    Return reversed list. You can use only iteration
    :param lst: input list
    :return: reversed list
    """
    lst_reversed = []
    i = len(lst) - 1

    while i >= 0:
        lst_reversed.append(lst[i])
        i -= 1
    return lst_reversed


def reverse_inplace_iterative(lst: list[int]) -> None:
    """
    Revert list inplace. You can use only iteration
    :param lst: input list
    :return: None
    """
    for i in range(len(lst) // 2):
        lst[i], lst[len(lst)-i-1] = lst[len(lst)-i-1], lst[i]
