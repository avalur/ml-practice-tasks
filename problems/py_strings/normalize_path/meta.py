META = {
    "title": "Normalize a Path",
    "topic": "py_strings",
    "difficulty": "medium",
    "entry": "normalize_path",
    "order": 3,
    "py_deps": [],
    "banned": {
        "modules": ["pathlib"],
        "names": ["normpath"],
    },
    "hints": [
        "Split on '/'. Skip '' and '.' components; on '..' pop the stack (unless it's empty / its top is '..').",
        "Track whether the path is absolute (leading '/'); rejoin with '/'. Empty relative result is '.'.",
    ],
    "statement": """
Implement `normalize_path(path)` — like `os.path.normpath`, but you write it.

Collapse repeated slashes, drop `.` components, and resolve `..` against the
preceding component. A leading `..` survives in a relative path; `..` at the
root of an absolute path is dropped. The empty path and `"."` normalize to
`"."`; the root stays `"/"`. For example `normalize_path("/a/b/../c") == "/a/c"`
and `normalize_path("a/..///../b") == "../b"`.

`pathlib` and `os.path.normpath` are not allowed. Do it in a single
O(len(path)) pass — some tests use very long paths.
""",
}
