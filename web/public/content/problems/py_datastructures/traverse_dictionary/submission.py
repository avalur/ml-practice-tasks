import typing as tp


def traverse_dictionary_immutable(
        dct: tp.Mapping[str, tp.Any], prefix: str = "") -> list[tuple[str, int]]:
    """
    Flatten an arbitrarily nested dict (values are ints or nested dicts) into a
    list of ``(dotted_key, value)`` pairs, e.g. ``{"a": {"b": 1}}`` →
    ``[("a.b", 1)]``. Pure recursion that returns a new list. Order is not
    important (the tests sort).

    :param dct: nested mapping
    :param prefix: accumulated key path (used by the recursion)
    :return: list of (full key joined by ".", value)
    """
    raise NotImplementedError("Your code here")


def traverse_dictionary_mutable(
        dct: tp.Mapping[str, tp.Any], result: list[tuple[str, int]], prefix: str = "") -> None:
    """
    Same flattening, but append the pairs to the given ``result`` list instead
    of returning (recursion that mutates an accumulator).

    :param dct: nested mapping
    :param result: list to append ``(full key, value)`` pairs to
    :param prefix: accumulated key path
    :return: None
    """
    raise NotImplementedError("Your code here")


def traverse_dictionary_iterative(dct: tp.Mapping[str, tp.Any]) -> list[tuple[str, int]]:
    """
    Same flattening with **no recursion** — use an explicit stack so it handles
    very deeply nested dicts (100000 levels) without hitting the recursion
    limit.

    :param dct: nested mapping
    :return: list of (full key joined by ".", value)
    """
    raise NotImplementedError("Your code here")
