def get_squares(elements: list[int]) -> list[int]:
    """Return the squares of the elements (use a list comprehension). No loops."""
    return [x ** 2 for x in elements]


def get_indices_from_one(elements: list[int]) -> list[int]:
    """Return 1-based indices ``[1, 2, ..., len(elements)]``. No loops."""
    return list(range(1, len(elements) + 1))


def get_max_element_index(elements: list[int]) -> int | None:
    """Return the index of the maximum element, or None if empty. No loops."""
    if not elements:
        return None
    return elements.index(max(elements))


def get_every_second_element(elements: list[int]) -> list[int]:
    """Return every second element, starting from the one at index 1. No loops."""
    return elements[1::2]


def get_first_three_index(elements: list[int]) -> int | None:
    """Return the index of the first ``3``, or None if there is none. No loops."""
    if 3 not in elements:
        return None
    return elements.index(3)


def get_last_three_index(elements: list[int]) -> int | None:
    """Return the index of the last ``3``, or None if there is none. No loops."""
    if 3 not in elements:
        return None
    return len(elements) - 1 - elements[::-1].index(3)


def get_sum(elements: list[int]) -> int:
    """Return the sum of the elements. No loops."""
    return sum(elements)


def get_min_max(elements: list[int], default: int | None) -> tuple[int | None, int | None]:
    """Return ``(min, max)``, or ``(default, default)`` if empty. No loops."""
    if not elements:
        return default, default
    return min(elements), max(elements)


def get_by_index(elements: list[int], i: int, boundary: int) -> int | None:
    """Return ``elements[i]`` if it is greater than ``boundary``, else None. No loops."""
    return value if (value := elements[i]) > boundary else None
