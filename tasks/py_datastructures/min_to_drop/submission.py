from collections import Counter
import typing as tp


def get_min_to_drop(seq: tp.Sequence[tp.Any]) -> int:
    """
    Return the minimum number of elements to remove from ``seq`` so that all
    remaining elements are equal. Equivalently: ``len(seq)`` minus the count of
    the most frequent element. An empty sequence needs 0 removals.

    :param seq: a sequence of hashable elements
    :return: minimum number of elements to drop
    """
    raise NotImplementedError("Your code here")
