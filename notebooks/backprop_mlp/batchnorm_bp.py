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
    # Batch Norm Backpropagation

    Implement the backward pass through a batch normalization layer.
    The forward graph is decomposed into 12 nodes — implement each one's
    gradient function below.

    **Forward graph** (shapes for reference: batch=32, hidden=64):
    ```
    logits    [32, 27] = h @ W2 + b2
    h         [32, 64] = tanh(hpreact)
    hpreact   [32, 64] = bngain * bnraw + bnbias
    bnraw     [32, 64] = bndiff * bnvar_inv
    bnvar_inv [1, 64]  = (bnvar + eps)**(-0.5)
    bnvar     [1, 64]  = bndiff2.mean(0, keepdims=True)
    bndiff2   [32, 64] = bndiff**2
    bndiff    [32, 64] = hprebn - bnmeani
    bnmeani   [1, 64]  = hprebn.mean(0, keepdims=True)
    ```

    Implement all 12 backward functions below. Each takes the upstream
    gradient and returns the downstream gradient for its inputs.
    """)
    return


@app.cell
def _(mo):
    mo.md("## Task — implement the 12 backward functions")
    return


@app.cell
def _(mo):
    # --- student: begin ---

    def h_bp(dlogits, W2):
        """logits = h @ W2 + b2  →  dh = dlogits @ W2.T"""
        raise NotImplementedError("Implement h_bp")

    def W2_bp(h, dlogits):
        """logits = h @ W2 + b2  →  dW2 = h.T @ dlogits"""
        raise NotImplementedError("Implement W2_bp")

    def b2_bp(dlogits):
        """logits = h @ W2 + b2  →  db2 = dlogits.sum(0)"""
        raise NotImplementedError("Implement b2_bp")

    def hpreact_bp(h, dh):
        """h = tanh(hpreact)  →  dhpreact = (1 - h**2) * dh"""
        raise NotImplementedError("Implement hpreact_bp")

    def bngain_bp(bnraw, dhpreact):
        """hpreact = bngain * bnraw + bnbias  →  dbngain, shape [1, dim]"""
        raise NotImplementedError("Implement bngain_bp")

    def bnbias_bp(dhpreact):
        """hpreact = bngain * bnraw + bnbias  →  dbnbias, shape [1, dim]"""
        raise NotImplementedError("Implement bnbias_bp")

    def bnraw_bp(dhpreact, bngain):
        """hpreact = bngain * bnraw + bnbias  →  dbnraw"""
        raise NotImplementedError("Implement bnraw_bp")

    def bnvar_inv_bp(bndiff, dbnraw):
        """bnraw = bndiff * bnvar_inv  →  dbnvar_inv, shape [1, dim]"""
        raise NotImplementedError("Implement bnvar_inv_bp")

    def bnvar_bp(bnvar, dbnvar_inv, eps=1e-5):
        """bnvar_inv = (bnvar + eps)**(-0.5)  →  dbnvar"""
        raise NotImplementedError("Implement bnvar_bp")

    def bndiff2_bp(bndiff2, n, dbnvar):
        """bnvar = bndiff2.mean(0)  →  dbndiff2"""
        raise NotImplementedError("Implement bndiff2_bp")

    def bndiff_bp(bndiff, dbndiff2, bnvar_inv, dbnraw):
        """bndiff contributes via bndiff2 (=bndiff**2) and bnraw (=bndiff*bnvar_inv)"""
        raise NotImplementedError("Implement bndiff_bp")

    def bnmeani_bp(dbndiff):
        """bndiff = hprebn - bnmeani  →  dbnmeani, shape [1, dim]"""
        raise NotImplementedError("Implement bnmeani_bp")

    # --- student: end ---
    return (h_bp, W2_bp, b2_bp, hpreact_bp, bngain_bp, bnbias_bp,
            bnraw_bp, bnvar_inv_bp, bnvar_bp, bndiff2_bp, bndiff_bp, bnmeani_bp)


@app.cell(hide_code=True)
def _(b2_bp, bngain_bp, bnbias_bp, bnmeani_bp, bnraw_bp, bnvar_bp,
      bnvar_inv_bp, bndiff2_bp, bndiff_bp, h_bp, hpreact_bp, mo, np, W2_bp):
    rng = np.random.default_rng(3)
    n, hidden, out = 32, 64, 27

    # Generate random tensors
    hprebn = rng.standard_normal((n, hidden))
    bngain = rng.standard_normal((1, hidden)) + 1.0
    bnbias = rng.standard_normal((1, hidden))
    W2 = rng.standard_normal((hidden, out))
    b2 = rng.standard_normal(out)
    dlogits = rng.standard_normal((n, out))

    # Forward pass (compute intermediates)
    h = np.tanh(hprebn)
    logits = h @ W2 + b2

    bnmeani = hprebn.mean(0, keepdims=True)
    bndiff = hprebn - bnmeani
    bndiff2 = bndiff ** 2
    bnvar = bndiff2.mean(0, keepdims=True)
    eps = 1e-5
    bnvar_inv = (bnvar + eps) ** -0.5
    bnraw = bndiff * bnvar_inv
    hpreact = bngain * bnraw + bnbias

    _solved = False
    try:
        # Verify all 12 functions against oracles
        _dh = h_bp(dlogits, W2)
        assert np.allclose(_dh, dlogits @ W2.T, atol=1e-5), "h_bp failed"

        _dW2 = W2_bp(h, dlogits)
        assert np.allclose(_dW2, h.T @ dlogits, atol=1e-5), "W2_bp failed"

        _db2 = b2_bp(dlogits)
        assert np.allclose(_db2, dlogits.sum(0), atol=1e-5), "b2_bp failed"

        _dhpreact = hpreact_bp(h, _dh)
        assert np.allclose(_dhpreact, (1 - h**2) * _dh, atol=1e-5), "hpreact_bp failed"

        _dbngain = bngain_bp(bnraw, _dhpreact)
        assert np.allclose(_dbngain, (bnraw * _dhpreact).sum(0, keepdims=True), atol=1e-5), "bngain_bp failed"

        _dbnbias = bnbias_bp(_dhpreact)
        assert np.allclose(_dbnbias, _dhpreact.sum(0, keepdims=True), atol=1e-5), "bnbias_bp failed"

        _dbnraw = bnraw_bp(_dhpreact, bngain)
        assert np.allclose(_dbnraw, bngain * _dhpreact, atol=1e-5), "bnraw_bp failed"

        _dbnvar_inv = bnvar_inv_bp(bndiff, _dbnraw)
        assert np.allclose(_dbnvar_inv, (bndiff * _dbnraw).sum(0, keepdims=True), atol=1e-5), "bnvar_inv_bp failed"

        _dbnvar = bnvar_bp(bnvar, _dbnvar_inv, eps)
        assert np.allclose(_dbnvar, -0.5 * (bnvar + eps)**(-1.5) * _dbnvar_inv, atol=1e-5), "bnvar_bp failed"

        _dbndiff2 = bndiff2_bp(bndiff2, n, _dbnvar)
        assert np.allclose(_dbndiff2, _dbnvar / n * np.ones_like(bndiff2), atol=1e-5), "bndiff2_bp failed"

        _dbndiff = bndiff_bp(bndiff, _dbndiff2, bnvar_inv, _dbnraw)
        assert np.allclose(_dbndiff, 2 * bndiff * _dbndiff2 + bnvar_inv * _dbnraw, atol=1e-5), "bndiff_bp failed"

        _dbnmeani = bnmeani_bp(_dbndiff)
        assert np.allclose(_dbnmeani, -_dbndiff.sum(0, keepdims=True), atol=1e-5), "bnmeani_bp failed"

        _result = mo.callout(mo.md("✅ All 12 batch norm backward functions correct!"), kind="success")
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
        for _fn in (h_bp, W2_bp, b2_bp, hpreact_bp, bngain_bp, bnbias_bp,
                    bnraw_bp, bnvar_inv_bp, bnvar_bp, bndiff2_bp, bndiff_bp, bnmeani_bp,):
            try:
                _srcs.append(_inspect.getsource(_fn))
            except Exception:
                pass
        _payload = _json.dumps({"notebookId": "backprop_mlp/batchnorm_bp",
                                "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps(
                {"type": "mlp:notebook-solved", "notebookId": "backprop_mlp/batchnorm_bp"})))
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
