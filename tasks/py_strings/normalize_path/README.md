# Normalize a Path

**Topic:** `py_strings` &nbsp;|&nbsp; **Difficulty:** medium

Implement `normalize_path(path)` — like `os.path.normpath`, but you write it.

Collapse repeated slashes, drop `.` components, and resolve `..` against the
preceding component. A leading `..` survives in a relative path; `..` at the
root of an absolute path is dropped. The empty path and `"."` normalize to
`"."`; the root stays `"/"`. For example `normalize_path("/a/b/../c") == "/a/c"`
and `normalize_path("a/..///../b") == "../b"`.

`pathlib` and `os.path.normpath` are not allowed. Do it in a single
O(len(path)) pass — some tests use very long paths.

## Constraints

- Forbidden modules: pathlib
- Forbidden functions: normpath

## How to run

```bash
pytest tasks/py_strings/normalize_path
```
Edit `submission.py` until every test passes.
