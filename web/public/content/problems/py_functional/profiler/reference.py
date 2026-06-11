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
    @wraps(func)
    def wrapper(*args, **kwargs):
        if wrapper.depth == 0:
            wrapper.calls = 0
        wrapper.depth += 1
        wrapper.calls += 1
        start = time.perf_counter()
        try:
            return func(*args, **kwargs)
        finally:
            wrapper.depth -= 1
            if wrapper.depth == 0:
                wrapper.last_time_taken = time.perf_counter() - start

    wrapper.depth = 0
    wrapper.calls = 0
    wrapper.last_time_taken = 0.0
    return wrapper
