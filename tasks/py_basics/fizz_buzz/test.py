import pytest

from tools.checks import assert_clean


def _oracle(n: int) -> list[int | str]:
    # Independent formulation: concatenate the two words, fall back to the int.
    out: list[int | str] = []
    for i in range(1, n + 1):
        word = ("Fizz" if i % 3 == 0 else "") + ("Buzz" if i % 5 == 0 else "")
        out.append(word if word else i)
    return out


@pytest.mark.parametrize("n", [0, 1, 2, 3, 5, 15, 16, 30, 100])
def test_get_fizz_buzz(impl, n):
    got = impl.get_fizz_buzz(n)
    assert len(got) == n
    assert got == _oracle(n)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
