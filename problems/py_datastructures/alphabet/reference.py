def extract_alphabet(graph: dict[str, set[str]]) -> list[str]:
    """
    Topologically sort the order ``graph`` (``graph[a]`` holds the letters that
    must come *after* ``a``) into a single alphabet: a list of all letters where
    every constraint ``a`` before ``b`` is respected. ``graphlib`` is off-limits.

    :param graph: partial order, ``{letter: set of letters that come after it}``
    :return: one valid total order of all letters
    """
    # --- solution: begin ---
    indegree = {node: 0 for node in graph}
    for node in graph:
        for nxt in graph[node]:
            indegree[nxt] += 1
    queue = [node for node in graph if indegree[node] == 0]
    order: list[str] = []
    while queue:
        node = queue.pop()
        order.append(node)
        for nxt in graph[node]:
            indegree[nxt] -= 1
            if indegree[nxt] == 0:
                queue.append(nxt)
    return order
    # --- solution: end ---


def build_graph(words: list[str]) -> dict[str, set[str]]:
    """
    Build the order graph implied by a list of words sorted in an unknown
    alphabet. Every letter that appears is a key. For each pair of adjacent
    words, the first position where they differ gives one ordering constraint:
    the earlier word's letter comes before the later word's letter.

    :param words: words sorted in the unknown alphabet's order
    :return: graph ``{letter: set of letters that come strictly after it}``
    """
    # --- solution: begin ---
    graph: dict[str, set[str]] = {}
    for word in words:
        for ch in word:
            graph.setdefault(ch, set())
    for first, second in zip(words, words[1:]):
        for a, b in zip(first, second):
            if a != b:
                graph[a].add(b)
                break
    return graph
    # --- solution: end ---


def get_alphabet(words: list[str]) -> list[str]:
    """Build the order graph from the sorted words, then topologically sort it."""
    graph = build_graph(words)
    return extract_alphabet(graph)
