import sys
from contextlib import contextmanager
from typing import Iterator, TextIO, Type


@contextmanager
def supresser(*types_: Type[BaseException]) -> Iterator[None]:
    """
    Context manager that **suppresses** exceptions whose type is in ``types_``
    (the block exits normally); any other exception propagates.
    """
    # --- solution: begin ---
    try:
        yield
    except types_:
        pass
    # --- solution: end ---


@contextmanager
def retyper(type_from: Type[BaseException], type_to: Type[BaseException]) -> Iterator[None]:
    """
    Context manager that catches ``type_from`` and re-raises it as ``type_to``,
    preserving the exception arguments (``args``). Other exceptions propagate.
    """
    # --- solution: begin ---
    try:
        yield
    except type_from as e:
        raise type_to(*e.args) from e
    # --- solution: end ---


@contextmanager
def dumper(stream: TextIO | None = None) -> Iterator[None]:
    """
    Context manager that, on any exception, writes its message to ``stream``
    (default ``sys.stderr``) and then re-raises it.
    """
    # --- solution: begin ---
    if stream is None:
        stream = sys.stderr
    try:
        yield
    except Exception as e:
        print(e, file=stream)
        raise
    # --- solution: end ---
