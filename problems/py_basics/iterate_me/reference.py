def get_squares(elements: list[int]) -> list[int]:
    """Return the squares of the elements (use a list comprehension). No loops."""
    # --- solution: begin ---
    return [x ** 2 for x in elements]
    # --- solution: end ---


def get_indices_from_one(elements: list[int]) -> list[int]:
    """Return 1-based indices ``[1, 2, ..., len(elements)]``. No loops."""
    # --- solution: begin ---
    return list(range(1, len(elements) + 1))
    # --- solution: end ---


def get_max_element_index(elements: list[int]) -> int | None:
    """Return the index of the maximum element, or None if empty. No loops."""
    # --- solution: begin ---
    if not elements:
        return None
    return elements.index(max(elements))
    # --- solution: end ---


def get_every_second_element(elements: list[int]) -> list[int]:
    """Return every second element, starting from the one at index 1. No loops."""
    # --- solution: begin ---
    return elements[1::2]
    # --- solution: end ---


def get_first_three_index(elements: list[int]) -> int | None:
    """Return the index of the first ``3``, or None if there is none. No loops."""
    # --- solution: begin ---
    if 3 not in elements:
        return None
    return elements.index(3)
    # --- solution: end ---


def get_last_three_index(elements: list[int]) -> int | None:
    """Return the index of the last ``3``, or None if there is none. No loops."""
    # --- solution: begin ---
    if 3 not in elements:
        return None
    return len(elements) - 1 - elements[::-1].index(3)
    # --- solution: end ---


def get_sum(elements: list[int]) -> int:
    """Return the sum of the elements. No loops."""
    # --- solution: begin ---
    return sum(elements)
    # --- solution: end ---


def get_min_max(elements: list[int], default: int | None) -> tuple[int | None, int | None]:
    """Return ``(min, max)``, or ``(default, default)`` if empty. No loops."""
    # --- solution: begin ---
    if not elements:
        return default, default
    return min(elements), max(elements)
    # --- solution: end ---


def get_by_index(elements: list[int], i: int, boundary: int) -> int | None:
    """Return ``elements[i]`` if it is greater than ``boundary``, else None. No loops."""
    # --- solution: begin ---
    return value if (value := elements[i]) > boundary else None
    # --- solution: end ---
