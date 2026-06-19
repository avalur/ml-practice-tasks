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
    # Attention Head

    The core of every transformer is **scaled dot-product attention**:

    $$\text{Attention}(Q, K, V) = \text{softmax}\!\left(\frac{QK^\top}{\sqrt{d_k}}\right) V$$

    Given an input sequence $x$ of shape $[T, d_{\text{model}}]$:

    1. Project to queries, keys, values:
       $Q = xW_Q,\;\; K = xW_K,\;\; V = xW_V$
       Each projection matrix $W_* \in \mathbb{R}^{d_{\text{model}} \times d_k}$.

    2. Compute raw attention scores: $S = QK^\top / \sqrt{d_k}$   (shape $[T, T]$)

    3. Apply **causal mask**: set $S_{ij} = -\infty$ for all $j > i$
       (a token may only attend to itself and earlier tokens).

    4. Softmax across the last axis to get weights $A$.

    5. Return $AV$   (shape $[T, d_k]$).

    In this notebook $x$ has shape $[B, T, d_{\text{model}}]$ (batched),
    so all matrix operations broadcast over the batch dimension $B$.

    ## Task

    Implement `attention_head(x, Wq, Wk, Wv)` following the 5 steps above.
    """)
    return


@app.cell
def _(np):
    # --- student: begin ---

    def attention_head(
        x:  np.ndarray,   # [B, T, n_embd]
        Wq: np.ndarray,   # [n_embd, head_size]
        Wk: np.ndarray,   # [n_embd, head_size]
        Wv: np.ndarray,   # [n_embd, head_size]
    ) -> np.ndarray:      # [B, T, head_size]
        """Single self-attention head with causal (lower-triangular) masking.

        Steps:
          1. Q = x @ Wq,  K = x @ Wk,  V = x @ Wv
          2. scores = Q @ K.transpose(-2, -1) / sqrt(head_size)
          3. Mask: scores[..., i, j] = -inf  for j > i  (future tokens)
          4. weights = softmax(scores, axis=-1)
          5. return weights @ V
        """
        raise NotImplementedError("Implement attention_head")

    # --- student: end ---
    return (attention_head,)


@app.cell(hide_code=True)
def _(attention_head, mo, np):
    # Oracle
    def _oracle(x, Wq, Wk, Wv):
        B, T, _ = x.shape
        head_size = Wq.shape[1]
        Q = x @ Wq              # [B, T, head_size]
        K = x @ Wk
        V = x @ Wv
        scores = Q @ K.swapaxes(-2, -1) / np.sqrt(head_size)   # [B, T, T]
        # Causal mask: positions j > i get -inf
        mask = np.triu(np.ones((T, T), dtype=bool), k=1)
        scores[:, mask] = -np.inf
        # Numerically stable softmax
        scores -= scores.max(axis=-1, keepdims=True)
        w = np.exp(scores)
        w /= w.sum(axis=-1, keepdims=True)
        return w @ V            # [B, T, head_size]

    _solved = False
    try:
        rng = np.random.default_rng(0)
        B, T, n_embd, head_size = 2, 5, 8, 4
        x   = rng.standard_normal((B, T, n_embd))
        Wq  = rng.standard_normal((n_embd, head_size)) * 0.1
        Wk  = rng.standard_normal((n_embd, head_size)) * 0.1
        Wv  = rng.standard_normal((n_embd, head_size)) * 0.1

        out  = attention_head(x, Wq, Wk, Wv)
        exp  = _oracle(x, Wq, Wk, Wv)

        assert out.shape == (B, T, head_size), \
            f"shape: expected {(B, T, head_size)}, got {out.shape}"
        assert np.allclose(out, exp, atol=1e-6), \
            f"values differ: max diff = {np.abs(out - exp).max():.2e}"

        # Verify causal property: row 0 must not depend on tokens 1..T-1
        # Change token 1 and verify token 0's output is unchanged
        x2 = x.copy(); x2[:, 1:, :] += 999.0
        out2 = attention_head(x2, Wq, Wk, Wv)
        assert np.allclose(out[:, 0, :], out2[:, 0, :], atol=1e-4), \
            "Causal masking broken: position 0 should not see future tokens"

        _result = mo.callout(mo.md(
            f"✅ `attention_head` correct!  shape {out.shape},  "
            f"max error vs oracle: {np.abs(out - exp).max():.2e}"
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
        for _fn in (attention_head,):
            try:
                _srcs.append(_inspect.getsource(_fn))
            except Exception:
                pass
        _payload = _json.dumps({"notebookId": "transformers/attention_head",
                                "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps(
                {"type": "mlp:notebook-solved", "notebookId": "transformers/attention_head"})))
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
