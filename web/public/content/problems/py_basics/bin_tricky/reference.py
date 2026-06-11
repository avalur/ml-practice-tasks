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
    a, b = nums1, nums2
    if len(a) > len(b):
        a, b = b, a
    m, n = len(a), len(b)
    total = m + n
    half = (total + 1) // 2
    lo, hi = 0, m
    while lo <= hi:
        i = (lo + hi) // 2          # take i elements of `a` into the left part
        j = half - i                # take j elements of `b` into the left part
        a_left = a[i - 1] if i > 0 else float("-inf")
        a_right = a[i] if i < m else float("inf")
        b_left = b[j - 1] if j > 0 else float("-inf")
        b_right = b[j] if j < n else float("inf")
        if a_left <= b_right and b_left <= a_right:
            if total % 2 == 1:
                return float(max(a_left, b_left))
            return (max(a_left, b_left) + min(a_right, b_right)) / 2
        if a_left > b_right:
            hi = i - 1
        else:
            lo = i + 1
    raise ValueError("inputs are not sorted")
