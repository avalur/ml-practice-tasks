# Minimum Drops to Equal

**Topic:** `py_datastructures` &nbsp;|&nbsp; **Difficulty:** easy

Implement `get_min_to_drop(seq)`.

Return the minimum number of elements to remove so that all remaining elements
are equal. That equals `len(seq)` minus the count of the most frequent element
(an empty sequence needs 0). For example `get_min_to_drop([1, 2, 3, 1]) == 2`
(drop the 2 and the 3, keep the two 1s).

## How to run

```bash
pytest tasks/py_datastructures/min_to_drop
```
Edit `submission.py` until every test passes.
