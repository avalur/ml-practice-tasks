def extract_alphabet(graph: dict[str, set[str]]) -> list[str]:
    """
    Topologically sort the order ``graph`` (``graph[a]`` holds the letters that
    must come *after* ``a``) into a single alphabet: a list of all letters where
    every constraint ``a`` before ``b`` is respected. ``graphlib`` is off-limits.

    :param graph: partial order, ``{letter: set of letters that come after it}``
    :return: one valid total order of all letters
    """
    raise NotImplementedError("Your code here")


def build_graph(words: list[str]) -> dict[str, set[str]]:
    """
    Build the order graph implied by a list of words sorted in an unknown
    alphabet. Every letter that appears is a key. For each pair of adjacent
    words, the first position where they differ gives one ordering constraint:
    the earlier word's letter comes before the later word's letter.

    :param words: words sorted in the unknown alphabet's order
    :return: graph ``{letter: set of letters that come strictly after it}``
    """
    raise NotImplementedError("Your code here")


def get_alphabet(words: list[str]) -> list[str]:
    """Build the order graph from the sorted words, then topologically sort it."""
    graph = build_graph(words)
    return extract_alphabet(graph)
