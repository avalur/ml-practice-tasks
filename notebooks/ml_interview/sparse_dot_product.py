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
    # Sparse Dot Product

    **LeetCode 1570 (premium) · ML interview staple**

    Given two **sparse** vectors `v1` and `v2` (lists of numbers, mostly zeros),
    compute their dot product **efficiently** — without multiplying pairs that
    are zero in either vector.

    **ML relevance**: this is the core operation behind sparse feature vectors
    (TF-IDF, bag-of-words, one-hot), collaborative filtering, and any
    matrix-vector product with a CSR/CSC sparse matrix.  At scale, skipping
    zero pairs can reduce computation by 100×.

    ## Naive vs efficient

    | Approach | Time | When to use |
    |---|---|---|
    | `sum(a*b for a,b in zip(v1, v2))` | O(n) | dense vectors |
    | Index-set intersection | O(nnz₁ + nnz₂) | sparse vectors |

    **Efficient approach**:  represent each vector as `{index: value}` for
    non-zero entries, then iterate over the *smaller* dict and look up indices
    in the *larger* one.

    ```python
    d1 = {i: v for i, v in enumerate(v1) if v != 0}
    d2 = {i: v for i, v in enumerate(v2) if v != 0}
    if len(d1) > len(d2):
        d1, d2 = d2, d1
    return sum(val * d2[i] for i, val in d1.items() if i in d2)
    ```

    The interviewer is checking that you don't loop over all zeros.
    """)
    return


@app.cell
def _():
    # --- student: begin ---

    def sparseDotProduct(v1: list, v2: list) -> float:
        """Compute the dot product of two sparse vectors efficiently.

        Args:
            v1: list of numbers (mostly zeros), length n
            v2: list of numbers (mostly zeros), same length n

        Returns:
            Scalar dot product: sum(v1[i] * v2[i] for i in range(n))
            but computed without iterating over zero pairs.
        """
        raise NotImplementedError("Implement sparseDotProduct")

    # --- student: end ---
    return (sparseDotProduct,)


@app.cell
def _(mo, sparseDotProduct):
    import math as _math

    def _oracle(v1, v2):
        return sum(a * b for a, b in zip(v1, v2))

    _cases = [
        ([1, 0, 0, 2, 3], [0, 3, 0, 4, 0], 8.0),
        ([0, 1, 0, 0, 0], [0, 0, 0, 0, 2], 0.0),
        ([1, 2, 3],        [4, 5, 6],       32.0),
        ([0, 0, 0],        [0, 0, 0],        0.0),
        ([0, 0, 1],        [0, 0, 1],        1.0),
        ([1.5, 0, 2.0],    [0, 3.0, 4.0],    8.0),
    ]

    _solved = False
    try:
        for _v1, _v2, _expected in _cases:
            _got = sparseDotProduct(_v1[:], _v2[:])
            assert _math.isclose(_got, _expected, rel_tol=1e-9), \
                f"sparseDotProduct({_v1}, {_v2}): expected {_expected}, got {_got}"

        # Efficiency check: result on large sparse vectors should be fast
        # (a naive zip-loop over 1 million zeros would be slow in Pyodide)
        _n = 200_000
        _big1 = [0.0] * _n; _big1[42] = 3.0; _big1[99999] = 7.0
        _big2 = [0.0] * _n; _big2[42] = 2.0; _big2[99999] = 5.0
        _got_big = sparseDotProduct(_big1, _big2)
        assert _math.isclose(_got_big, 41.0, rel_tol=1e-9), \
            f"Large sparse: expected 41.0, got {_got_big}"

        _result = mo.callout(mo.md(
            "✅ `sparseDotProduct` is correct and handles large sparse inputs!"
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
        for _fn in (sparseDotProduct,):
            try:
                _srcs.append(_inspect.getsource(_fn))
            except Exception:
                pass
        _payload = _json.dumps({"notebookId": "ml_interview/sparse_dot_product",
                                "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps(
                {"type": "mlp:notebook-solved",
                 "notebookId": "ml_interview/sparse_dot_product"})))
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
