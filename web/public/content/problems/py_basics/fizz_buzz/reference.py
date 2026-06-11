def get_fizz_buzz(n: int) -> list[int | str]:
    """
    Return a list of length ``n`` whose element at position ``i`` (0-based)
    describes the number ``i + 1``:

    * ``"FizzBuzz"`` if the number is divisible by 15,
    * ``"Fizz"``     if divisible by 3 (but not 15),
    * ``"Buzz"``     if divisible by 5 (but not 15),
    * otherwise the number itself (an ``int``).

    For example ``get_fizz_buzz(5) == [1, 2, "Fizz", 4, "Buzz"]``.

    :param n: length of the sequence (``n >= 0``)
    :return: the FizzBuzz list
    """
    result: list[int | str] = []
    for i in range(1, n + 1):
        if i % 15 == 0:
            result.append("FizzBuzz")
        elif i % 3 == 0:
            result.append("Fizz")
        elif i % 5 == 0:
            result.append("Buzz")
        else:
            result.append(i)
    return result
