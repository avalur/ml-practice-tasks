from collections.abc import Iterable, Iterator, Sized


class RangeIterator(Iterator[int]):
    """Iterator over a Range — yields its values one at a time."""

    def __init__(self, range_: "Range") -> None:
        self._range = range_
        self._index = 0

    def __iter__(self) -> "RangeIterator":
        return self

    def __next__(self) -> int:
        if self._index >= len(self._range):
            raise StopIteration
        value = self._range[self._index]
        self._index += 1
        return value


class Range(Sized, Iterable[int]):
    """
    An immutable arithmetic sequence that mimics the built-in ``range``.

    ``Range(stop)``, ``Range(start, stop)`` or ``Range(start, stop, step)``
    (``start`` defaults to 0, ``step`` to 1; ``step == 0`` raises ``ValueError``).
    Supports iteration (re-iterable), ``len``, indexing with negative indices
    (``IndexError`` out of range), ``in`` in O(1), and a ``range``-style repr.
    """

    def __init__(self, *args: int) -> None:
        if len(args) == 1:
            self.start, self.stop, self.step = 0, args[0], 1
        elif len(args) == 2:
            self.start, self.stop, self.step = args[0], args[1], 1
        elif len(args) == 3:
            self.start, self.stop, self.step = args
        else:
            raise TypeError("Range expects 1 to 3 integer arguments")
        if self.step == 0:
            raise ValueError("Range() arg 3 must not be zero")
        if self.step > 0:
            self._len = max(0, (self.stop - self.start + self.step - 1) // self.step)
        else:
            self._len = max(0, (self.start - self.stop - self.step - 1) // (-self.step))

    def __iter__(self) -> "RangeIterator":
        return RangeIterator(self)

    def __repr__(self) -> str:
        if self.step == 1:
            return f"range({self.start}, {self.stop})"
        return f"range({self.start}, {self.stop}, {self.step})"

    def __str__(self) -> str:
        return repr(self)

    def __contains__(self, key: int) -> bool:
        if self.step > 0:
            if not (self.start <= key < self.stop):
                return False
        else:
            if not (self.stop < key <= self.start):
                return False
        return (key - self.start) % self.step == 0

    def __getitem__(self, key: int) -> int:
        index = key if key >= 0 else self._len + key
        if index < 0 or index >= self._len:
            raise IndexError("Range index out of range")
        return self.start + index * self.step

    def __len__(self) -> int:
        return self._len
