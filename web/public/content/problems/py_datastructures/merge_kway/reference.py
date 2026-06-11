import heapq
import typing as tp


def merge(lists: tp.Sequence[tp.Sequence[int]]) -> list[int]:
    """
    Merge ``k`` lists, each already sorted in non-decreasing order, into one
    sorted list. Use a **heap** for an O(N log k) merge (N = total elements);
    don't just concatenate and ``sorted`` it, and don't slice. Do not modify
    the inputs.

    :param lists: a sequence of sorted lists
    :return: one merged sorted list
    """
    heap: list[tuple[int, int, int]] = []
    for i, lst in enumerate(lists):
        if lst:
            heapq.heappush(heap, (lst[0], i, 0))
    result: list[int] = []
    while heap:
        value, i, j = heapq.heappop(heap)
        result.append(value)
        if j + 1 < len(lists[i]):
            heapq.heappush(heap, (lists[i][j + 1], i, j + 1))
    return result
