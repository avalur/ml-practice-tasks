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
    # LRU Cache

    **LeetCode 146 · NeetCode 150 — Linked List / Design**

    Design a data structure that follows the **Least Recently Used** cache
    eviction policy.  Implement the `LRUCache` class:

    - `LRUCache(capacity)` — initialise with a positive capacity.
    - `get(key) → int` — return the value if `key` exists, else `-1`.
       Reading a key counts as a "use" (move it to the most-recently-used position).
    - `put(key, value)` — insert or update the key.  If capacity is exceeded,
       evict the least recently used key first.

    Both `get` and `put` must run in **O(1)** time.

    **ML relevance**: caches of exactly this kind appear in model serving
    (embedding lookups, feature store), online inference (computed representations),
    and recommendation systems (user/item embeddings).  Understanding the
    trade-off between recency and capacity is core MLE knowledge.

    ## Expected approach — OrderedDict or doubly linked list + hash map

    Python's `collections.OrderedDict` supports O(1) `move_to_end` and
    `popitem(last=False)`, making the implementation concise:

    For extra credit: implement the same thing *without* `OrderedDict` using
    a doubly-linked list (head = LRU, tail = MRU) and a plain dict.
    """)
    return


@app.cell
def _():
    # --- student: begin ---

    class LRUCache:
        """Least Recently Used cache with O(1) get and put.

        Args:
            capacity: maximum number of key-value pairs to store (≥ 1).
        """

        def __init__(self, capacity: int):
            raise NotImplementedError("Implement LRUCache.__init__")

        def get(self, key: int) -> int:
            """Return the value for key, or -1 if not present.
            Accessing a key marks it as most recently used."""
            raise NotImplementedError("Implement LRUCache.get")

        def put(self, key: int, value: int) -> None:
            """Insert or update key-value.  Evict LRU entry if over capacity."""
            raise NotImplementedError("Implement LRUCache.put")

    # --- student: end ---
    return (LRUCache,)


@app.cell(hide_code=True)
def _(LRUCache, mo):
    def _run_sequence(capacity, ops):
        """ops: list of ('get', key) or ('put', key, val) tuples."""
        cache = LRUCache(capacity)
        results = []
        for op in ops:
            if op[0] == "get":
                results.append(cache.get(op[1]))
            else:
                cache.put(op[1], op[2])
                results.append(None)
        return results

    _solved = False
    try:
        # ── Sequence 1: LeetCode example ──
        _ops1 = [
            ("put", 1, 1),
            ("put", 2, 2),
            ("get", 1),        # → 1
            ("put", 3, 3),     # evicts key 2
            ("get", 2),        # → -1
            ("put", 4, 4),     # evicts key 1
            ("get", 1),        # → -1
            ("get", 3),        # → 3
            ("get", 4),        # → 4
        ]
        _res1 = _run_sequence(2, _ops1)
        _exp1 = [None, None, 1, None, -1, None, -1, 3, 4]
        assert _res1 == _exp1, f"Sequence 1: expected {_exp1}, got {_res1}"

        # ── Sequence 2: single-capacity ──
        _ops2 = [
            ("put", 1, 10),
            ("get", 1),        # → 10
            ("put", 2, 20),    # evicts 1
            ("get", 1),        # → -1
            ("get", 2),        # → 20
        ]
        _res2 = _run_sequence(1, _ops2)
        _exp2 = [None, 10, None, -1, 20]
        assert _res2 == _exp2, f"Sequence 2: expected {_exp2}, got {_res2}"

        # ── Sequence 3: update existing key (no eviction) ──
        _ops3 = [
            ("put", 1, 1),
            ("put", 2, 2),
            ("put", 1, 10),    # update key 1 → no eviction
            ("get", 2),        # → 2  (key 2 still present)
            ("get", 1),        # → 10
        ]
        _res3 = _run_sequence(2, _ops3)
        _exp3 = [None, None, None, 2, 10]
        assert _res3 == _exp3, f"Sequence 3: expected {_exp3}, got {_res3}"

        # ── Sequence 4: get promotes key, saving it from eviction ──
        _ops4 = [
            ("put", 1, 1),
            ("put", 2, 2),
            ("get", 1),        # promotes key 1 → now MRU
            ("put", 3, 3),     # evicts key 2 (LRU)
            ("get", 2),        # → -1
            ("get", 1),        # → 1
            ("get", 3),        # → 3
        ]
        _res4 = _run_sequence(2, _ops4)
        _exp4 = [None, None, 1, None, -1, 1, 3]
        assert _res4 == _exp4, f"Sequence 4: expected {_exp4}, got {_res4}"

        _result = mo.callout(mo.md("✅ `LRUCache` is correct on all test sequences!"), kind="success")
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
        for _fn in (LRUCache,):
            try:
                _srcs.append(_inspect.getsource(_fn))
            except Exception:
                pass
        _payload = _json.dumps({"notebookId": "ml_interview/lru_cache",
                                "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps(
                {"type": "mlp:notebook-solved", "notebookId": "ml_interview/lru_cache"})))
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
