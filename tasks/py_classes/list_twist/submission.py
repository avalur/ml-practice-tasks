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

    raise NotImplementedError("Your code here")
