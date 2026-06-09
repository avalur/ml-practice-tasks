def find_value(nums: list[int] | range, value: int) -> bool:
    """
    Return whether ``value`` occurs in ``nums`` — a sequence of integers sorted
    in non-decreasing order (it may be empty). Use **binary search**: O(log n)
    time, O(1) extra space.

    The ``in`` operator and the ``bisect`` module are off-limits — you implement
    the search yourself.

    :param nums: sorted sequence of integers (possibly empty)
    :param value: the integer to look for
    :return: True if value is present, False otherwise
    """
    # --- solution: begin ---
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == value:
            return True
        if nums[mid] < value:
            lo = mid + 1
        else:
            hi = mid - 1
    return False
    # --- solution: end ---
