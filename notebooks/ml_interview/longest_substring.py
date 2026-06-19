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
    # Longest Substring Without Repeating Characters

    **LeetCode 3 · NeetCode 150 — Sliding Window**

    Given a string `s`, return the length of the longest substring that
    contains no repeating characters.

    **ML relevance**: the sliding window pattern recurs in sequence modelling —
    attention windows, context windows, session-based recommendation, temporal
    feature extraction from event streams.  Mastering it means you can reason
    about rolling statistics and bounded-memory processing.

    ## Expected approach — sliding window, O(n)

    Maintain a window `[left, right)` and a set of characters currently in it.
    Advance `right`; whenever `s[right]` is already in the set, shrink from
    `left` until the duplicate is removed.

    ```python
    left = 0
    seen = set()
    best = 0
    for right, ch in enumerate(s):
        while ch in seen:
            seen.remove(s[left])
            left += 1
        seen.add(ch)
        best = max(best, right - left + 1)
    return best
    ```

    The dict variant stores the last-seen index of each character and jumps
    `left` directly — same O(n) but fewer iterations.
    """)
    return


@app.cell
def _():
    # --- student: begin ---

    def lengthOfLongestSubstring(s: str) -> int:
        """Return the length of the longest substring with all unique characters.

        Args:
            s: input string (may contain letters, digits, spaces, symbols)

        Returns:
            Length of the longest such substring (0 if s is empty).
        """
        raise NotImplementedError("Implement lengthOfLongestSubstring")

    # --- student: end ---
    return (lengthOfLongestSubstring,)


@app.cell
def _(lengthOfLongestSubstring, mo):
    def _oracle(s):
        best = 0
        for i in range(len(s)):
            seen = set()
            for j in range(i, len(s)):
                if s[j] in seen:
                    break
                seen.add(s[j])
                best = max(best, j - i + 1)
        return best

    _cases = [
        ("abcabcbb", 3),
        ("bbbbb",    1),
        ("pwwkew",   3),
        ("",         0),
        ("au",       2),
        (" ",        1),
        ("dvdf",     3),
        ("abcdefg",  7),
        ("aab",      2),
    ]

    _solved = False
    try:
        for _s, _expected in _cases:
            _got = lengthOfLongestSubstring(_s)
            assert _got == _expected, \
                f"lengthOfLongestSubstring('{_s}'): expected {_expected}, got {_got}"

        _result = mo.callout(mo.md(
            "✅ `lengthOfLongestSubstring` is correct on all test cases!"
        ), kind="success")
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
        for _fn in (lengthOfLongestSubstring,):
            try:
                _srcs.append(_inspect.getsource(_fn))
            except Exception:
                pass
        _payload = _json.dumps({"notebookId": "ml_interview/longest_substring",
                                "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps(
                {"type": "mlp:notebook-solved",
                 "notebookId": "ml_interview/longest_substring"})))
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
