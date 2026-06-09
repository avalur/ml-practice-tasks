# Count Utility (wc)

**Topic:** `py_strings` &nbsp;|&nbsp; **Difficulty:** easy

Implement `count_util(text, flags=None)` — a tiny `wc`-like counter.

`flags` is a command-line-style string selecting which counts to return:
`-m` → `"chars"` (number of characters), `-l` → `"lines"` (number of newline
characters), `-L` → `"longest_line"` (length of the longest line), `-w` →
`"words"` (whitespace-separated words). Flags may be combined (`"-lm"` or
`"-l -m"`). An empty string or `None` means all four. Return a dict containing
only the selected keys.

## How to run

```bash
pytest tasks/py_strings/count_util
```
Edit `submission.py` until every test passes.
