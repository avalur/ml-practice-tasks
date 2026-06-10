from collections import UserList
import typing as tp


class ListTwist(UserList[tp.Any]):
    """
    A list (``UserList``) with extra *virtual* attributes — provided through
    ``__getattr__`` / ``__setattr__`` only (no properties or methods named after
    them):

    * ``reversed`` / ``R`` — the list reversed (a new plain list).
    * ``first`` / ``F`` — get or set the first element (undefined if empty).
    * ``last`` / ``L`` — get or set the last element (undefined if empty).
    * ``size`` / ``S`` — get or set the length: shrinking truncates, growing
      pads with ``None``.
    """

    # --- solution: begin ---
    def __getattr__(self, name: str) -> tp.Any:
        if name in ("reversed", "R"):
            return list(reversed(self.data))
        if name in ("first", "F"):
            return self.data[0]
        if name in ("last", "L"):
            return self.data[-1]
        if name in ("size", "S"):
            return len(self.data)
        raise AttributeError(name)

    def __setattr__(self, name: str, value: tp.Any) -> None:
        if name in ("first", "F"):
            self.data[0] = value
        elif name in ("last", "L"):
            self.data[-1] = value
        elif name in ("size", "S"):
            if value < len(self.data):
                self.data[:] = self.data[:value]
            else:
                self.data.extend([None] * (value - len(self.data)))
        else:
            super().__setattr__(name, value)
    # --- solution: end ---
