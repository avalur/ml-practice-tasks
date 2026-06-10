import pytest

from tools.checks import assert_clean

# (message, shift, expected) — ground-truth examples.
CASES = [
    ("A", 1, "B"),
    ("XYZ", 5, "CDE"),
    ("Help me, im stuck inside this computer", 2,
     "Jgnr og, ko uvwem kpukfg vjku eqorwvgt"),
    ("Roses are Red, Violets are blue", 4,
     "Vswiw evi Vih, Zmspixw evi fpyi"),
    ("AbCdEfGhIjKlMnOp", -2, "YzAbCdEfGhIjKlMn"),
    ("Veni vidi vici", 0, "Veni vidi vici"),
    ("Veni vidi vici", 26, "Veni vidi vici"),
    ("Veni vidi vici", -26, "Veni vidi vici"),
    ("This is stupid song", 1000, "Ftue ue efgbup eazs"),
]


@pytest.mark.parametrize("message, n, expected", CASES)
def test_caesar(impl, message, n, expected):
    assert impl.caesar_encrypt(message, n) == expected


def test_round_trip(impl):
    # Independent property: encrypt then decrypt by the same shift is identity.
    msg = "The quick brown fox, jumps! over 13 lazy dogs."
    for n in (1, 7, -5, 100):
        assert impl.caesar_encrypt(impl.caesar_encrypt(msg, n), -n) == msg


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
