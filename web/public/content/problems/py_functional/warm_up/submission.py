from collections.abc import Generator
from typing import Any


def transpose(matrix: list[list[Any]]) -> list[list[Any]]:
    """
    Transpose a rectangular matrix (list of equal-length rows): row i becomes
    column i.

    :param matrix: a rectangular matrix
    :return: the transposed matrix
    """
    raise NotImplementedError("Your code here")


def uniq(sequence: list[Any]) -> Generator[Any, None, None]:
    """
    Yield the elements of ``sequence`` in their original order, dropping later
    duplicates (keep the first occurrence). Must be a generator.

    :param sequence: a sequence of hashable elements
    :return: generator of the de-duplicated elements
    """
    raise NotImplementedError("Your code here")


def dict_merge(*dicts: dict[Any, Any]) -> dict[Any, Any]:
    """
    Merge flat dictionaries into one; on a key collision the value from the
    later dictionary wins.

    :param dicts: dictionaries to merge, in increasing priority
    :return: the merged dictionary
    """
    raise NotImplementedError("Your code here")


def product(lhs: list[int], rhs: list[int]) -> int:
    """
    Return the scalar (dot) product of two equal-length integer lists.

    :param lhs: first vector
    :param rhs: second vector
    :return: sum of element-wise products
    """
    raise NotImplementedError("Your code here")
