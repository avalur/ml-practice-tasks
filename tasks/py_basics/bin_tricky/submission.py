from collections.abc import Sequence


def find_median(nums1: Sequence[int], nums2: Sequence[int]) -> float:
    """
    Return the median of two sequences, each sorted in non-decreasing order (at
    least one is non-empty). The result is always a ``float``: the middle value
    when the combined length is odd, the average of the two middle values when
    it is even.

    Run in O(log(min(m, n))) — a binary search over the partition, **not** a
    merge. (Some tests use sequences of hundreds of millions of elements, where
    an O(m+n) scan would never finish.) ``sorted`` and the ``in`` operator are
    off-limits.

    :param nums1: first sorted sequence
    :param nums2: second sorted sequence
    :return: the median as a float
    """
    raise NotImplementedError("Your code here")
