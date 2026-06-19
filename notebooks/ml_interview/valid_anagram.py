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
    # Valid Anagram

    **LeetCode 242 · NeetCode 150 — Array & Hashing**

    Given two strings `s` and `t`, return `True` if `t` is an anagram of `s`,
    and `False` otherwise.  An anagram uses exactly the same characters the
    same number of times.

    **ML relevance**: character/token frequency counting is everywhere — the
    hashing trick, bag-of-words, feature canonicalization.  Group Anagrams
    (LeetCode 49) is a close cousin: group words by a canonical signature,
    which directly maps to grouping items by a hash key in feature engineering.

    ## Expected approach — character counts, O(n)

    Count every character in `s` and `t`, then compare.  A dict or array of
    26 counters both work.  Sorting (`sorted(s) == sorted(t)`) is O(n log n)
    and accepted at interview but shows less insight.

    ```python
    if len(s) != len(t):
        return False
    counts = {}
    for c in s: counts[c] = counts.get(c, 0) + 1
    for c in t: counts[c] = counts.get(c, 0) - 1
    return all(v == 0 for v in counts.values())
    ```
    """)
    return


@app.cell
def _():
    # --- student: begin ---

    def isAnagram(s: str, t: str) -> bool:
        """Return True if t is an anagram of s.

        Args:
            s: source string (lowercase letters)
            t: target string

        Returns:
            True if t uses the exact same characters (with counts) as s.
        """
        raise NotImplementedError("Implement isAnagram")

    # --- student: end ---
    return (isAnagram,)


@app.cell
def _(isAnagram, mo):
    _cases = [
        ("anagram",  "nagaram",  True),
        ("rat",      "car",      False),
        ("a",        "a",        True),
        ("ab",       "a",        False),
        ("listen",   "silent",   True),
        ("hello",    "world",    False),
        ("aab",      "baa",      True),
        ("",         "",         True),
    ]

    _solved = False
    try:
        for _s, _t, _expected in _cases:
            _got = isAnagram(_s, _t)
            assert isinstance(_got, bool), \
                f"isAnagram('{_s}', '{_t}') must return bool, got {type(_got)}"
            assert _got == _expected, \
                f"isAnagram('{_s}', '{_t}'): expected {_expected}, got {_got}"

        _result = mo.callout(mo.md("✅ `isAnagram` is correct on all test cases!"), kind="success")
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
        for _fn in (isAnagram,):
            try:
                _srcs.append(_inspect.getsource(_fn))
            except Exception:
                pass
        _payload = _json.dumps({"notebookId": "ml_interview/valid_anagram",
                                "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps(
                {"type": "mlp:notebook-solved", "notebookId": "ml_interview/valid_anagram"})))
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
