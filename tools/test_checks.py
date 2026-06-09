"""Unit tests for the static constraint checker (tools/checks.py).

Not collected by CI's `pytest problems` (testpaths=problems); run directly:
    python -m pytest tools/test_checks.py -q
The positive path is also exercised in CI via every problem's
`test_no_banned_constructs`, whose reference must stay clean.
"""

from __future__ import annotations

from tools.checks import find_violations


def test_membership_operator_banned() -> None:
    src = "def f(x, seq):\n    return x in seq\n"
    assert find_violations(src, {"operators": ["in"]}) == ["use of 'in' operator"]
    # not banned when `operators` is absent
    assert find_violations(src, {}) == []


def test_not_in_operator_banned() -> None:
    src = "def f(x, seq):\n    return x not in seq\n"
    assert find_violations(src, {"operators": ["not in"]}) == ["use of 'not in' operator"]
    # banning only "in" must not catch "not in"
    assert find_violations(src, {"operators": ["in"]}) == []


def test_slicing_banned_but_indexing_allowed() -> None:
    sliced = "def f(lst):\n    return lst[::-1]\n"
    assert find_violations(sliced, {"slicing": True}) == ["slice expression 'seq[a:b]'"]
    indexed = "def f(lst, i):\n    return lst[i]\n"
    assert find_violations(indexed, {"slicing": True}) == []


def test_names_ban_covers_builtins() -> None:
    src = "def f(x):\n    return sum(x)\n"
    assert find_violations(src, {"names": ["sum"]}) == ["use of 'sum'"]


def test_clean_binary_search_has_no_violations() -> None:
    src = (
        "def find_value(nums, value):\n"
        "    lo, hi = 0, len(nums) - 1\n"
        "    while lo <= hi:\n"
        "        mid = (lo + hi) // 2\n"
        "        if nums[mid] == value:\n"
        "            return True\n"
        "        if nums[mid] < value:\n"
        "            lo = mid + 1\n"
        "        else:\n"
        "            hi = mid - 1\n"
        "    return False\n"
    )
    # Bans relevant to bin_basic, but the iterative binary search trips none of
    # them (it uses comparisons + plain indexing, no `in`, no bisect, no slice).
    banned = {"modules": ["bisect"], "operators": ["in", "not in"], "slicing": True}
    assert find_violations(src, banned) == []
