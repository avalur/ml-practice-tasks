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
    # Two Sum

    **LeetCode 1 · NeetCode 150 — Array & Hashing**

    Given an array of integers `nums` and a target integer `target`, return
    the **indices** of the two numbers that add up to `target`.
    You may assume exactly one solution exists, and you may not use the same
    element twice.

    **ML relevance**: warm-up check for clean code and hash-map reasoning —
    the same lookup pattern appears in feature-store lookups, deduplication,
    and pair-wise matching.

    ## Expected approach — O(n) hash map

    Keep a dict `{value: index}` as you scan left-to-right.
    For each element check whether `target - element` is already in the dict.
    This avoids the O(n²) nested-loop approach the interviewer is watching for.

    ```
    seen = {}
    for i, x in enumerate(nums):
        complement = target - x
        if complement in seen:
            return [seen[complement], i]
        seen[x] = i
    ```
    """)
    return


@app.cell
def _():
    # --- student: begin ---

    def twoSum(nums: list, target: int) -> list:
        """Return [i, j] such that nums[i] + nums[j] == target (i < j).

        Args:
            nums:   list of integers
            target: integer target sum

        Returns:
            A list of two indices [i, j] with i < j.
        """
        raise NotImplementedError("Implement twoSum")

    # --- student: end ---
    return (twoSum,)


@app.cell
def _(mo, twoSum):
    def _oracle(nums, target):
        seen = {}
        for i, x in enumerate(nums):
            if target - x in seen:
                return sorted([seen[target - x], i])
            seen[x] = i
        return []

    _cases = [
        ([2, 7, 11, 15], 9,  [0, 1]),
        ([3, 2, 4],      6,  [1, 2]),
        ([3, 3],         6,  [0, 1]),
        ([1, 5, 3, 7],   8,  [1, 3]),
        ([-1, -2, -3, -4, -5], -8, [2, 4]),
    ]

    _solved = False
    try:
        for _nums, _target, _expected in _cases:
            _result_val = twoSum(_nums[:], _target)
            assert isinstance(_result_val, list) and len(_result_val) == 2, \
                f"twoSum({_nums}, {_target}) must return a list of 2 indices, got {_result_val}"
            _i, _j = sorted(_result_val)
            assert _nums[_i] + _nums[_j] == _target, \
                f"twoSum({_nums}, {_target}): nums[{_i}]+nums[{_j}]={_nums[_i]+_nums[_j]} ≠ {_target}"

        _result = mo.callout(mo.md("✅ `twoSum` is correct on all test cases!"), kind="success")
        _solved = True
    except NotImplementedError as e:
        _result = mo.callout(mo.md(f"✏️ {e}"), kind="neutral")
    except Exception as e:
        _result = mo.callout(mo.md(f"❌ {e}"), kind="danger")
    # --- capture & report (runs every time, pass or fail) ---
    try:
        import inspect as _inspect, json as _json, js as _js
        from pyodide.ffi import to_js as _to_js
        _srcs = []
        for _fn in (twoSum,):
            try:
                _srcs.append(_inspect.getsource(_fn))
            except Exception:
                pass
        _payload = _json.dumps({"notebookId": "ml_interview/two_sum",
                                "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps(
                {"type": "mlp:notebook-solved", "notebookId": "ml_interview/two_sum"})))
            _ch.close()
        _js.fetch("/api/notebook-progress", _to_js(
            {"method": "POST", "headers": {"Content-Type": "application/json"},
             "credentials": "include", "body": _payload},
            dict_converter=_js.Object.fromEntries))
    except Exception:
        pass  # not running in Pyodide WASM
    mo.output.replace(_result)
    return


if __name__ == "__main__":
    app.run()
