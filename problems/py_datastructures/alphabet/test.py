import copy
import itertools
import random
import string

import pytest

from tools.checks import assert_clean

# (words sorted in an unknown alphabet, expected order graph) — build_graph
# ground truth from the source course.
GRAPH_CASES = [
    ([], {}),
    (["bac"], {"a": set(), "b": set(), "c": set()}),
    (["aa", "aab"], {"a": set(), "b": set()}),
    (["a", "c", "cb", "cc"], {"a": {"c"}, "c": set(), "b": {"c"}}),
    (["aa", "aab", "acb"], {"a": {"c"}, "b": set(), "c": set()}),
    (["aaa", "bbb", "cccc"], {"a": {"b"}, "b": {"c"}, "c": set()}),
    (["aab", "aac", "aad"], {"b": {"c"}, "c": {"d"}, "a": set(), "d": set()}),
    (["aa", "aac", "aab"], {"c": {"b"}, "a": set(), "b": set()}),
    (["aawq", "aad", "aadf", "fdaa", "ffdd"],
     {"w": {"d"}, "a": {"f"}, "d": {"f"}, "f": set(), "q": set()}),
    (["a", "b", "ba", "bc", "bca", "bcd", "bcda", "bcde"],
     {"a": {"b", "c", "d", "e"}, "b": set(), "c": set(), "d": set(), "e": set()}),
]


@pytest.mark.parametrize("words, expected", GRAPH_CASES)
def test_build_graph(impl, words, expected):
    given = copy.deepcopy(words)
    assert impl.build_graph(words) == expected
    assert words == given, "You shouldn't change the inputs"


def _assert_valid_alphabet(order, words, graph):
    # every letter present exactly once
    assert sorted(order) == sorted(set(itertools.chain.from_iterable(words)))
    # every constraint a-before-b respected
    pos = {c: i for i, c in enumerate(order)}
    for a in graph:
        for b in graph[a]:
            assert pos[a] < pos[b], f"{a} must come before {b}"


@pytest.mark.parametrize("words, _expected", GRAPH_CASES)
def test_get_alphabet(impl, words, _expected):
    graph = impl.build_graph(copy.deepcopy(words))
    order = impl.get_alphabet(copy.deepcopy(words))
    _assert_valid_alphabet(order, words, graph)


def test_stress(impl):
    rng = random.Random(7)
    alphabet = list(string.ascii_lowercase)
    rng.shuffle(alphabet)
    rank = {c: i for i, c in enumerate(alphabet)}
    words: set[str] = set()
    while len(words) < 3000:
        length = rng.randint(3, 6)
        words.add("".join(rng.choice(alphabet) for _ in range(length)))
    ordered = sorted(words, key=lambda w: [rank[c] for c in w])
    graph = impl.build_graph(copy.deepcopy(ordered))
    order = impl.get_alphabet(copy.deepcopy(ordered))
    _assert_valid_alphabet(order, ordered, graph)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
