import typing as tp

def test1():
    nums = [1, 2, 3]
    target = 3
    assert find_value(nums, target)


def find_value(nums: tp.Union[list[int], range], value: int) -> bool:
    """
    Find value in sorted sequence
    :param nums: sequence of integers. Could be empty
    :param value: integer to find
    :return: True if value exists, False otherwise
    """
    left = 0
    right = len(nums)
    while left < right:
        m = (left + right) // 2
        if nums[m] == value:
            return True
        elif nums[m] < value:
            left = m + 1
        else:
            right = m
    return False
