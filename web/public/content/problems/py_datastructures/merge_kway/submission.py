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
    raise NotImplementedError("Your code here")
