def reverse_iterative(lst: list[int]) -> list[int]:
    """
    Return a new list with the elements of ``lst`` in reverse order, using
    **iteration only**. Do not modify the input.

    The ``reversed`` builtin and slicing (``lst[::-1]``) are off-limits — build
    the result yourself by indexing from the end.

    :param lst: input list
    :return: a new reversed list
    """
    # --- solution: begin ---
    result: list[int] = []
    for i in range(len(lst) - 1, -1, -1):
        result.append(lst[i])
    return result
    # --- solution: end ---
