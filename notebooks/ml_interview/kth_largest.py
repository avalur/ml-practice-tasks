import marimo

__generated_with = "0.23.9"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    return (mo,)


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    # Kth Largest Element in an Array

    **LeetCode 215 · NeetCode 150 — Heap / Priority Queue**

    Given an integer array `nums` and an integer `k`, return the **k-th
    largest** element in the array.  Note: this is the k-th largest in sorted
    order, not the k-th distinct element.

    **ML relevance**: thresholding, top-percentile selection, quantile
    computation, top-score filtering in retrieval and ranking.

    ## Expected approaches

    **Min-heap of size k — O(n log k)**
    Keep a heap of the k largest seen so far; its root is the answer.

    ```python
    import heapq
    heap = []
    for x in nums:
        heapq.heappush(heap, x)
        if len(heap) > k:
            heapq.heappop(heap)
    return heap[0]
    ```

    **Quickselect — O(n) average** (bonus)
    Partition around a pivot (like quicksort), recurse only into the side
    that contains the k-th position.  Expected O(n), worst O(n²).

    Sorting the entire array in O(n log n) is correct but not what the
    interviewer is looking for — mention the heap or quickselect approach.
    """)
    return


@app.cell
def _():
    # --- student: begin ---

    def findKthLargest(nums: list, k: int) -> int:
        """Return the k-th largest element (1-indexed: k=1 means the maximum).

        Args:
            nums: list of integers (may contain duplicates)
            k:    rank from the top (1 ≤ k ≤ len(nums))

        Returns:
            The k-th largest integer in nums.
        """
        raise NotImplementedError("Implement findKthLargest")

    # --- student: end ---
    return (findKthLargest,)


@app.cell
def _(findKthLargest, mo):
    _cases = [
        ([3, 2, 1, 5, 6, 4],   2, 5),
        ([3, 2, 3, 1, 2, 4, 5, 5, 6], 4, 4),
        ([1],                   1, 1),
        ([2, 1],                1, 2),
        ([2, 1],                2, 1),
        ([7, 7, 7, 7],          3, 7),
        ([-1, -2, -3],          1, -1),
    ]

    _solved = False
    try:
        for _nums, _k, _expected in _cases:
            _got = findKthLargest(_nums[:], _k)
            assert _got == _expected, \
                f"findKthLargest({_nums}, {_k}): expected {_expected}, got {_got}"

        _result = mo.callout(mo.md("✅ `findKthLargest` is correct on all test cases!"), kind="success")
        _solved = True
    except NotImplementedError as e:
        _result = mo.callout(mo.md(f"✏️ {e}"), kind="neutral")
    except Exception as e:
        _result = mo.callout(mo.md(f"❌ {e}"), kind="danger")
    # --- capture & report ---
    try:
        import inspect as _inspect, json as _json, js as _js
        from pyodide.ffi import to_js as _to_js
        _srcs = []
        for _fn in (findKthLargest,):
            try:
                _srcs.append(_inspect.getsource(_fn))
            except Exception:
                pass
        _payload = _json.dumps({"notebookId": "ml_interview/kth_largest",
                                "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps(
                {"type": "mlp:notebook-solved", "notebookId": "ml_interview/kth_largest"})))
            _ch.close()
        _js.fetch("/api/notebook-progress", _to_js(
            {"method": "POST", "headers": {"Content-Type": "application/json"},
             "credentials": "include", "body": _payload},
            dict_converter=_js.Object.fromEntries))
    except Exception:
        pass
    mo.output.replace(_result)
    return


if __name__ == "__main__":
    app.run()
