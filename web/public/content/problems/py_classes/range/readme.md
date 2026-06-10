# Custom Range

**Topic:** `py_classes` &nbsp;|&nbsp; **Difficulty:** medium

Implement a `Range` class (plus its `RangeIterator`) that mimics the built-in
`range`: an immutable arithmetic sequence.

`Range(stop)`, `Range(start, stop)`, or `Range(start, stop, step)` — `start`
defaults to 0, `step` to 1, and `step == 0` raises `ValueError`. Support
iteration (re-iterable), `len`, indexing with negative indices (`IndexError`
when out of range), membership (`in`) in **O(1)**, and a `range`-style `repr`
(`str(Range(10)) == "range(0, 10)"`).

## How to run

```bash
pytest tasks/py_classes/range
```
Edit `submission.py` until every test passes.
