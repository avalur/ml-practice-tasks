import marimo

__generated_with = "0.23.9"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import numpy as np
    return mo, np


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    # Fused Batch Norm Gradient

    In the previous notebook you implemented 12 separate backward functions
    for batch normalization. Here you implement a **single fused** function
    that is mathematically equivalent to composing all 12 steps.

    The fused formula:
    ```
    dhprebn = bngain * bnvar_inv / n * (
        n * dhpreact
        - dhpreact.sum(0)
        - n / (n - 1) * bnraw * (dhpreact * bnraw).sum(0)
    )
    ```

    This is the standard batch-norm backward formula — implement it directly.
    """)
    return


@app.cell
def _(mo):
    mo.md("## Task — implement the fused `hprebn_bp` function")
    return


@app.cell
def _(mo):
    # --- student: begin ---

    def hprebn_bp(n, bngain, bnvar_inv, bnraw, dhpreact):
        """Fused batch-norm backward — equivalent to the 12-step decomposition.

        dhprebn = bngain * bnvar_inv / n * (
            n * dhpreact
            - dhpreact.sum(0)
            - n / (n - 1) * bnraw * (dhpreact * bnraw).sum(0)
        )
        """
        raise NotImplementedError("Implement hprebn_bp")

    # --- student: end ---
    return (hprebn_bp,)


@app.cell(hide_code=True)
def _(hprebn_bp, mo, np):
    rng = np.random.default_rng(5)
    n, hidden = 16, 8

    hprebn  = rng.standard_normal((n, hidden))
    bngain  = rng.standard_normal((1, hidden)) + 1.0
    bnbias  = rng.standard_normal((1, hidden))
    dhpreact = rng.standard_normal((n, hidden))
    eps = 1e-5

    bnmeani  = hprebn.mean(0, keepdims=True)
    bndiff   = hprebn - bnmeani
    bndiff2  = bndiff ** 2
    bnvar    = bndiff2.mean(0, keepdims=True)
    bnvar_inv = (bnvar + eps) ** -0.5
    bnraw    = bndiff * bnvar_inv

    _solved = False
    try:
        result   = hprebn_bp(n, bngain, bnvar_inv, bnraw, dhpreact)
        expected = bngain * bnvar_inv / n * (
            n * dhpreact - dhpreact.sum(0) - n / (n - 1) * bnraw * (dhpreact * bnraw).sum(0)
        )
        assert np.allclose(result, expected, atol=1e-9), \
            f"max diff: {np.abs(result - expected).max():.2e}"

        _result = mo.callout(mo.md("✅ Fused batch norm backward is correct!"), kind="success")
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
        for _fn in (hprebn_bp,):
            try:
                _srcs.append(_inspect.getsource(_fn))
            except Exception:
                pass
        _payload = _json.dumps({"notebookId": "backprop_mlp/batchnorm_fused",
                                "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps(
                {"type": "mlp:notebook-solved", "notebookId": "backprop_mlp/batchnorm_fused"})))
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
