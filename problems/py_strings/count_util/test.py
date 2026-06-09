import pytest

from tools.checks import assert_clean

TEXT = "one two\nthree\n"  # 14 chars, 2 newlines, words: one/two/three, longest 'one two'=7

# (text, flags, expected) — counts worked out by hand from the definitions.
CASES = [
    (TEXT, "-m", {"chars": 14}),
    (TEXT, "-l", {"lines": 2}),
    (TEXT, "-w", {"words": 3}),
    (TEXT, "-L", {"longest_line": 7}),
    (TEXT, "-wl", {"words": 3, "lines": 2}),
    (TEXT, "-w -l", {"words": 3, "lines": 2}),
    (TEXT, "", {"chars": 14, "lines": 2, "words": 3, "longest_line": 7}),
    (TEXT, None, {"chars": 14, "lines": 2, "words": 3, "longest_line": 7}),
    ("", "", {"chars": 0, "lines": 0, "words": 0, "longest_line": 0}),
    ("abc\ndefg", "", {"chars": 8, "lines": 1, "words": 2, "longest_line": 4}),
    ("abc\ndefg\n", "", {"chars": 9, "lines": 2, "words": 2, "longest_line": 4}),
    ("\n\n\n\n", "", {"chars": 4, "lines": 4, "words": 0, "longest_line": 0}),
    ("  spaced   words \n  x \n", "-wL", {"words": 3, "longest_line": 17}),
]


@pytest.mark.parametrize("text, flags, expected", CASES)
def test_count_util(impl, text, flags, expected):
    assert impl.count_util(text, flags) == expected


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
