# K-Way Merge (Heap)

**Topic:** `py_datastructures` &nbsp;|&nbsp; **Difficulty:** medium

Implement `merge(lists)`.

Merge `k` lists — each already sorted in non-decreasing order — into one sorted
list, using a **heap** (`heapq`) for an O(N log k) merge. Don't concatenate and
`sorted`, and don't slice. Leave the inputs unchanged. For example
`merge([[1, 4, 7], [2, 3, 8], [0, 5, 9]]) == [0, 1, 2, 3, 4, 5, 7, 8, 9]`.

## Constraints

- Forbidden functions: sorted
- Slicing `seq[a:b]` is not allowed (plain indexing `seq[i]` is fine)

## How to run

```bash
pytest tasks/py_datastructures/merge_kway
```
Edit `submission.py` until every test passes.
