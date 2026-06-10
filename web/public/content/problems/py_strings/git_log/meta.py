META = {
    "title": "Reformat a Git Log",
    "topic": "py_strings",
    "difficulty": "easy",
    "entry": "reformat_git_log",
    "order": 4,
    "py_deps": [],
    "banned": {},
    "hints": [
        "Iterate the input stream line by line; split each line on tabs — field 0 is the sha, the last field is the message.",
        "Write sha[:7], then dots filling up to width 80, then the message and a newline.",
    ],
    "statement": """
Implement `reformat_git_log(inp, out)`.

Read a git log from the text stream `inp` and write a reformatted version to the
text stream `out` (return nothing). Each input line is tab-separated:
`<sha-1>\\t<date>\\t<author>\\t<email>\\t<message>`. Each output line is the
first 7 characters of the sha, then enough dots so the line is exactly 80
characters wide, then the message — e.g.
`0cd8619....................................................Update PEP 512 (#107)`.
""",
}
