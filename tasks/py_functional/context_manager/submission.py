import sys
from contextlib import contextmanager
from typing import Iterator, TextIO, Type


@contextmanager
def supresser(*types_: Type[BaseException]) -> Iterator[None]:
    """
    Context manager that **suppresses** exceptions whose type is in ``types_``
    (the block exits normally); any other exception propagates.
    """
    raise NotImplementedError("Your code here")


@contextmanager
def retyper(type_from: Type[BaseException], type_to: Type[BaseException]) -> Iterator[None]:
    """
    Context manager that catches ``type_from`` and re-raises it as ``type_to``,
    preserving the exception arguments (``args``). Other exceptions propagate.
    """
    raise NotImplementedError("Your code here")


@contextmanager
def dumper(stream: TextIO | None = None) -> Iterator[None]:
    """
    Context manager that, on any exception, writes its message to ``stream``
    (default ``sys.stderr``) and then re-raises it.
    """
    raise NotImplementedError("Your code here")
