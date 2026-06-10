# Alien Alphabet (Topological Sort)

**Topic:** `py_datastructures` &nbsp;|&nbsp; **Difficulty:** hard

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

## Constraints

- Forbidden modules: graphlib

## How to run

```bash
pytest tasks/py_datastructures/alphabet
```
Edit `submission.py` until every test passes.
