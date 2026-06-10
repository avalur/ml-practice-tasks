from collections.abc import Iterable, Iterator, Sized


class RangeIterator(Iterator[int]):
    """Iterator over a Range — yields its values one at a time."""

    def __init__(self, range_: "Range") -> None:
        raise NotImplementedError("Your code here")

    def __iter__(self) -> "RangeIterator":
        raise NotImplementedError("Your code here")

    def __next__(self) -> int:
        raise NotImplementedError("Your code here")


class Range(Sized, Iterable[int]):
    """
    An immutable arithmetic sequence that mimics the built-in ``range``.

    ``Range(stop)``, ``Range(start, stop)`` or ``Range(start, stop, step)``
    (``start`` defaults to 0, ``step`` to 1; ``step == 0`` raises ``ValueError``).
    Supports iteration (re-iterable), ``len``, indexing with negative indices
    (``IndexError`` out of range), ``in`` in O(1), and a ``range``-style repr.
    """

    def __init__(self, *args: int) -> None:
        raise NotImplementedError("Your code here")

    def __iter__(self) -> "RangeIterator":
        raise NotImplementedError("Your code here")

    def __repr__(self) -> str:
        raise NotImplementedError("Your code here")

    def __str__(self) -> str:
        raise NotImplementedError("Your code here")

    def __contains__(self, key: int) -> bool:
        raise NotImplementedError("Your code here")

    def __getitem__(self, key: int) -> int:
        raise NotImplementedError("Your code here")

    def __len__(self) -> int:
        raise NotImplementedError("Your code here")
