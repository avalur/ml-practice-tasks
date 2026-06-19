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
    # Top K Frequent Elements

    **LeetCode 347 · NeetCode 150 — Heap / Priority Queue**

    Given an integer array `nums` and an integer `k`, return the `k` most
    frequent elements.  The answer may be in any order.

    **ML relevance**: this pattern is everywhere — top-k tokens in a corpus,
    most popular items in a recommendation system, dominant feature values,
    frequent categories in a dataset.  Understanding it also unlocks the
    *bucket sort* trick useful whenever values are bounded.

    ## Expected approaches

    **Heap — O(n log k)**
    Count frequencies with a dict, then maintain a min-heap of size k.

    **Bucket sort — O(n)** (optimal)
    Frequencies are in `[1, n]`, so make `n+1` buckets (bucket i holds
    elements with frequency i), then scan from the right.

    """)
    return


@app.cell
def _():
    # --- student: begin ---

    def topKFrequent(nums: list, k: int) -> list:
        """Return the k most frequent elements of nums (any order).

        Args:
            nums: list of integers (may contain duplicates)
            k:    how many top-frequent elements to return (1 ≤ k ≤ unique elements)

        Returns:
            A list of k integers, each being one of the most frequent elements.
            Order does not matter.
        """
        raise NotImplementedError("Implement topKFrequent")

    # --- student: end ---
    return (topKFrequent,)


@app.cell(hide_code=True)
def _(mo, topKFrequent):
    def _oracle(nums, k):
        count = {}
        for x in nums:
            count[x] = count.get(x, 0) + 1
        return [v for v, _ in sorted(count.items(), key=lambda p: -p[1])[:k]]

    _cases = [
        ([1, 1, 1, 2, 2, 3],        2, {1, 2}),
        ([1],                         1, {1}),
        ([4, 4, 4, 2, 2, 3],         1, {4}),
        ([1, 2, 3, 4, 5],            3, {1, 2, 3, 4, 5}),   # any 3 of 5 (all freq=1)
        ([5, 3, 1, 1, 1, 3, 73, 1],  2, {1, 3}),
    ]

    _solved = False
    try:
        for _nums, _k, _expected_set in _cases:
            _got = topKFrequent(_nums[:], _k)
            assert isinstance(_got, list), \
                f"topKFrequent must return a list, got {type(_got)}"
            assert len(_got) == _k, \
                f"topKFrequent({_nums}, {_k}): expected {_k} elements, got {len(_got)}"
            # Verify each returned element is genuinely one of the top-k frequent
            _oracle_result = _oracle(_nums, _k)
            _oracle_freqs = sorted(set(_oracle_result))
            _min_oracle_freq = min(
                sum(1 for x in _nums if x == v) for v in _oracle_result
            )
            for _v in _got:
                _freq = sum(1 for x in _nums if x == _v)
                assert _freq >= _min_oracle_freq, \
                    f"topKFrequent({_nums}, {_k}): {_v} has freq={_freq} but " \
                    f"min top-{_k} freq is {_min_oracle_freq}"

        _result = mo.callout(mo.md("✅ `topKFrequent` is correct on all test cases!"), kind="success")
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
        for _fn in (topKFrequent,):
            try:
                _srcs.append(_inspect.getsource(_fn))
            except Exception:
                pass
        _payload = _json.dumps({"notebookId": "ml_interview/top_k_frequent",
                                "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps(
                {"type": "mlp:notebook-solved", "notebookId": "ml_interview/top_k_frequent"})))
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
