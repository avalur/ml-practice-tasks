META = {
    "title": "Count Utility (wc)",
    "topic": "py_strings",
    "difficulty": "easy",
    "entry": "count_util",
    "order": 2,
    "py_deps": [],
    "banned": {},
    "hints": [
        "Pull the flag letters out of the flags string (ignore '-' and spaces); empty/None means all four.",
        "chars = len(text), lines = text.count('\\n'), words = len(text.split()), longest_line = max line length.",
    ],
    "statement": """
Implement `count_util(text, flags=None)` — a tiny `wc`-like counter.

`flags` is a command-line-style string selecting which counts to return:
`-m` → `"chars"` (number of characters), `-l` → `"lines"` (number of newline
characters), `-L` → `"longest_line"` (length of the longest line), `-w` →
`"words"` (whitespace-separated words). Flags may be combined (`"-lm"` or
`"-l -m"`). An empty string or `None` means all four. Return a dict containing
only the selected keys.
""",
}
