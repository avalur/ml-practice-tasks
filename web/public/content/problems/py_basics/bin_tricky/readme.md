# Median of Two Sorted Sequences

**Topic:** `py_basics` &nbsp;|&nbsp; **Difficulty:** hard

Implement `find_median(nums1, nums2)`.

Both inputs are sorted in non-decreasing order (at least one is non-empty).
Return their combined median as a `float`: the middle value if the total length
is odd, otherwise the average of the two middle values.

Run in **O(log(min(m, n)))** — a binary search over the partition, not a merge
(some tests use sequences of length ~10**15, where scanning would never finish).
`sorted` and the `in` operator are not allowed.

## Constraints

- Forbidden functions: sorted
- Forbidden operators: in, not in

## How to run

```bash
pytest tasks/py_basics/bin_tricky
```
Edit `submission.py` until every test passes.
