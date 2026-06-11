META = {
    "title": "Alien Alphabet (Topological Sort)",
    "topic": "py_datastructures",
    "difficulty": "hard",
    "entry": "get_alphabet",
    "order": 5,
    "py_deps": [],
    "banned": {
        "modules": ["graphlib"],
    },
    "prereqs": ["py_datastructures/traverse_dictionary"],
    "hints": [
        "build_graph: every letter is a node; for each adjacent word pair, the first differing position gives one edge (earlier letter -> later letter).",
        "extract_alphabet: topological sort (Kahn's algorithm) — repeatedly take a node with no remaining incoming edges.",
    ],
    "statement": """
Recover an alphabet from a list of words sorted in an unknown order (the
"alien dictionary" problem). Implement two functions; `get_alphabet` (given) ties
them together.

- `build_graph(words)` → `{letter: set of letters that come strictly after it}`.
  Every letter that appears is a key. For each adjacent pair of words, the first
  position where they differ yields one constraint: the earlier word's letter
  comes before the later word's letter.
- `extract_alphabet(graph)` → a list of all letters in one order consistent with
  every constraint (a topological sort).

`graphlib` is not allowed — implement the sort yourself. Inputs must not change.
""",
}
