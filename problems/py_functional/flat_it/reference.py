from collections.abc import Iterable, Iterator
from typing import Any


def flat_it(sequence: Iterable[Any]) -> Iterator[Any]:
    """
    Lazily flatten an iterable with an arbitrary level of nested iterables into
    a flat stream of leaves. **Return a generator** (use ``yield``).

    Strings are iterable, so a multi-character string is flattened into its
    characters; stop recursing at a single character (otherwise iterating a
    1-char string would never terminate). Non-iterables are yielded as-is.

    :param sequence: an iterable, possibly deeply nested
    :return: a generator producing the flattened leaves in order
    """
    # --- solution: begin ---
    for item in sequence:
        if isinstance(item, Iterable) and not (isinstance(item, str) and len(item) <= 1):
            yield from flat_it(item)
        else:
            yield item
    # --- solution: end ---
