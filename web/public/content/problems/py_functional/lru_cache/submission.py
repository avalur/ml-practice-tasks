from collections import OrderedDict
from collections.abc import Callable
from functools import wraps
from typing import Any, TypeVar

Function = TypeVar("Function", bound=Callable[..., Any])


def cache(max_size: int) -> Callable[[Function], Function]:
    """
    Build a decorator that memoizes a function, keeping results for at most the
    ``max_size`` most recently used argument tuples (an LRU cache). On overflow,
    evict the least-recently-used entry. A cache hit must count as a use (it
    refreshes that entry's recency). Preserve the wrapped function's metadata.

    Implement it yourself — ``functools.lru_cache`` is off-limits. Assume
    positional, hashable arguments.

    :param max_size: maximum number of cached argument tuples
    :return: the memoizing decorator
    """
    raise NotImplementedError("Your code here")
