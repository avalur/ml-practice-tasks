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
    # Merge Intervals

    **LeetCode 56 · NeetCode 150 — Greedy / Intervals**

    Given an array of intervals `[[start, end], ...]`, merge all overlapping
    intervals and return the array of non-overlapping intervals that covers
    every input interval.

    Two intervals overlap if `start₂ ≤ end₁` (touching counts as overlap).

    **ML relevance**: batching time-series events, merging attention spans,
    deduplicating log entries, computing union of bounding boxes, combining
    session windows.

    ## Expected approach — sort then scan, O(n log n)

    """)
    return


@app.cell
def _():
    # --- student: begin ---

    def merge(intervals: list) -> list:
        """Merge overlapping intervals.

        Args:
            intervals: list of [start, end] pairs (integers), non-empty,
                       not necessarily sorted.

        Returns:
            A sorted list of merged [start, end] pairs with no overlaps.
            Touching intervals (end₁ == start₂) should be merged.
        """
        raise NotImplementedError("Implement merge")

    # --- student: end ---
    return (merge,)


@app.cell(hide_code=True)
def _(merge, mo):
    def _oracle(intervals):
        ivs = sorted(intervals, key=lambda x: x[0])
        out = [ivs[0][:]]
        for s, e in ivs[1:]:
            if s <= out[-1][1]:
                out[-1][1] = max(out[-1][1], e)
            else:
                out.append([s, e])
        return out

    _cases = [
        ([[1,3],[2,6],[8,10],[15,18]],   [[1,6],[8,10],[15,18]]),
        ([[1,4],[4,5]],                  [[1,5]]),
        ([[1,4],[2,3]],                  [[1,4]]),
        ([[1,4]],                        [[1,4]]),
        ([[2,3],[1,2]],                  [[1,3]]),
        ([[1,4],[0,0]],                  [[0,0],[1,4]]),
        ([[1,4],[0,4]],                  [[0,4]]),
        ([[3,5],[1,2],[6,7]],            [[1,2],[3,5],[6,7]]),
    ]

    _solved = False
    try:
        for _inp, _expected in _cases:
            _got = merge([iv[:] for iv in _inp])
            assert isinstance(_got, list), f"merge must return a list, got {type(_got)}"
            _got_sorted = sorted(_got)
            assert _got_sorted == _expected, \
                f"merge({_inp}): expected {_expected}, got {_got_sorted}"

        _result = mo.callout(mo.md("✅ `merge` is correct on all test cases!"), kind="success")
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
        for _fn in (merge,):
            try:
                _srcs.append(_inspect.getsource(_fn))
            except Exception:
                pass
        _payload = _json.dumps({"notebookId": "ml_interview/merge_intervals",
                                "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps(
                {"type": "mlp:notebook-solved",
                 "notebookId": "ml_interview/merge_intervals"})))
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
