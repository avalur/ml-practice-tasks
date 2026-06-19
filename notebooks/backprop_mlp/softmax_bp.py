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
    # Softmax & Cross-Entropy Backprop

    We decompose the backward pass through a numerically-stable softmax +
    cross-entropy loss into **8 small functions**, each corresponding to one
    node in the forward computational graph.

    All inputs and outputs are `np.ndarray`. Use only numpy.

    **Forward pass** (for context — do not implement):
    ```python
    logit_maxes = logits.max(axis=1, keepdims=True)
    norm_logits = logits - logit_maxes        # numerical stability
    counts      = np.exp(norm_logits)
    counts_sum  = counts.sum(axis=1, keepdims=True)
    counts_sum_inv = counts_sum ** -1
    probs       = counts * counts_sum_inv
    logprobs    = np.log(probs)
    loss        = -logprobs[np.arange(n), Yb].mean()
    ```

    Implement the backward functions in reverse order below.
    """)
    return


@app.cell
def _(mo):
    mo.md("## Task — implement the 8 backward functions")
    return


@app.cell
def _(mo):
    # --- student: begin ---

    def logprobs_bp(n, Yb, logprobs):
        """d(loss)/d(logprobs): -1/n at true-class indices, 0 elsewhere."""
        raise NotImplementedError("Implement logprobs_bp")

    def probs_bp(probs, dlogprobs):
        """d(logprobs)/d(probs) = 1/probs, so dprobs = dlogprobs / probs."""
        raise NotImplementedError("Implement probs_bp")

    def counts_sum_inv_bp(counts, dprobs):
        """probs = counts * counts_sum_inv  →  shape [n, 1]."""
        raise NotImplementedError("Implement counts_sum_inv_bp")

    def counts_sum_bp(counts_sum, dcounts_sum_inv):
        """counts_sum_inv = counts_sum**(-1)  →  d/d(counts_sum)."""
        raise NotImplementedError("Implement counts_sum_bp")

    def counts_bp(counts, dcounts_sum, counts_sum_inv, dprobs):
        """counts contributes via both probs and counts_sum."""
        raise NotImplementedError("Implement counts_bp")

    def norm_logits_bp(counts, dcounts):
        """counts = exp(norm_logits)  →  d/d(norm_logits) = counts * dcounts."""
        raise NotImplementedError("Implement norm_logits_bp")

    def logit_maxes_bp(dnorm_logits):
        """norm_logits = logits - logit_maxes  →  shape [n, 1]."""
        raise NotImplementedError("Implement logit_maxes_bp")

    def logits_bp(logits, dnorm_logits, dlogit_maxes):
        """logit_maxes = logits.max(1); norm_logits = logits - logit_maxes."""
        raise NotImplementedError("Implement logits_bp")

    # --- student: end ---
    return (logprobs_bp, probs_bp, counts_sum_inv_bp, counts_sum_bp,
            counts_bp, norm_logits_bp, logit_maxes_bp, logits_bp)


@app.cell(hide_code=True)
def _(logit_maxes_bp, logprobs_bp, counts_bp, counts_sum_bp,
      counts_sum_inv_bp, mo, norm_logits_bp, logits_bp, probs_bp, np):
    rng = np.random.default_rng(7)
    _n, _C = 16, 10
    _logits = rng.standard_normal((_n, _C))
    _Yb = rng.integers(0, _C, size=_n)

    # Forward pass
    _lm  = _logits.max(axis=1, keepdims=True)
    _nl  = _logits - _lm
    _cnt = np.exp(_nl)
    _cs  = _cnt.sum(axis=1, keepdims=True)
    _csi = _cs ** -1
    _pr  = _cnt * _csi
    _lp  = np.log(_pr)

    _solved = False
    try:
        _dlp  = logprobs_bp(_n, _Yb, _lp)
        _dpr  = probs_bp(_pr, _dlp)
        _dcsi = counts_sum_inv_bp(_cnt, _dpr)
        _dcs  = counts_sum_bp(_cs, _dcsi)
        _dc   = counts_bp(_cnt, _dcs, _csi, _dpr)
        _dnl  = norm_logits_bp(_cnt, _dc)
        _dlm  = logit_maxes_bp(_dnl)
        _dlo  = logits_bp(_logits, _dnl, _dlm)

        # Oracle: analytical cross-entropy gradient = softmax - one_hot, /n
        _sm = np.exp(_logits - _logits.max(1, keepdims=True))
        _sm /= _sm.sum(1, keepdims=True)
        _expected = _sm.copy()
        _expected[np.arange(_n), _Yb] -= 1
        _expected /= _n

        assert np.allclose(_dlo, _expected, atol=1e-6), \
            f"Final dlogits mismatch: max diff = {np.abs(_dlo - _expected).max():.2e}"

        _result = mo.callout(mo.md(
            "✅ All 8 backward functions correct! "
            f"Max error vs analytical gradient: {np.abs(_dlo - _expected).max():.2e}"
        ), kind="success")
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
        for _fn in (logprobs_bp, probs_bp, counts_sum_inv_bp, counts_sum_bp,
                    counts_bp, norm_logits_bp, logit_maxes_bp, logits_bp,):
            try:
                _srcs.append(_inspect.getsource(_fn))
            except Exception:
                pass
        _payload = _json.dumps({"notebookId": "backprop_mlp/softmax_bp",
                                "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps(
                {"type": "mlp:notebook-solved", "notebookId": "backprop_mlp/softmax_bp"})))
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
