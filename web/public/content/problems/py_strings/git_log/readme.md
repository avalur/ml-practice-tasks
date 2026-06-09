# Reformat a Git Log

**Topic:** `py_strings` &nbsp;|&nbsp; **Difficulty:** easy

Implement `reformat_git_log(inp, out)`.

Read a git log from the text stream `inp` and write a reformatted version to the
text stream `out` (return nothing). Each input line is tab-separated:
`<sha-1>\t<date>\t<author>\t<email>\t<message>`. Each output line is the
first 7 characters of the sha, then enough dots so the line is exactly 80
characters wide, then the message — e.g.
`0cd8619....................................................Update PEP 512 (#107)`.

## How to run

```bash
pytest tasks/py_strings/git_log
```
Edit `submission.py` until every test passes.
