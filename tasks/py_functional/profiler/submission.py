import time
from functools import wraps


def profiler(func):
    """
    Profiling decorator. The wrapped function gains two attributes:

    * ``calls`` — how many times it was invoked during the most recent
      top-level call (recursive calls count; the counter resets at the start of
      each new outermost call).
    * ``last_time_taken`` — wall-clock seconds the most recent top-level call
      took.

    The wrapper must preserve the original function's metadata (``__name__``,
    ``__doc__``, ...).

    :param func: function to wrap
    :return: the profiling wrapper
    """
    raise NotImplementedError("Your code here")
