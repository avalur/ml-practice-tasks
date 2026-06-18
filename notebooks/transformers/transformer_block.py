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
    # Transformer Block

    A complete transformer block combines:
    1. **Multi-head attention** with residual connection and pre-normalization
    2. **Feed-forward network** (two linear layers with ReLU) with residual connection and pre-normalization

    Below are the **working implementations** of `attention_head` and
    `multi_head_attention` from previous notebooks, provided as scaffolds.

    ## Task — implement 3 functions:
    - `feed_forward` — two-layer FFN with ReLU (hidden dim = 4 × n_embd)
    - `layer_norm` — layer normalization over the last axis
    - `transformer_block` — pre-norm attention + pre-norm FFN, both with residuals
    """)
    return


@app.cell
def _(np):
    """Working attention implementations — provided as scaffold."""
    def _scaffold_attention_head(x, Wq, Wk, Wv):
        B, T, _ = x.shape
        head_size = Wq.shape[1]
        Q = x @ Wq; K = x @ Wk; V = x @ Wv
        scores = Q @ K.swapaxes(-2, -1) / np.sqrt(head_size)
        mask = np.triu(np.ones((T, T), dtype=bool), k=1)
        scores[:, mask] = -np.inf
        scores -= scores.max(axis=-1, keepdims=True)
        w = np.exp(scores); w /= w.sum(axis=-1, keepdims=True)
        return w @ V

    def _scaffold_multi_head(x, heads, W_out):
        outs = [_scaffold_attention_head(x, Wq, Wk, Wv) for Wq, Wk, Wv in heads]
        return np.concatenate(outs, axis=-1) @ W_out

    return _scaffold_attention_head, _scaffold_multi_head


@app.cell
def _(mo):
    mo.md("## Task — implement `feed_forward`, `layer_norm`, and `transformer_block`")
    return


@app.cell
def _(mo):
    # --- student: begin ---

    def feed_forward(
        x:  np.ndarray,   # [B, T, n_embd]
        W1: np.ndarray,   # [n_embd, 4 * n_embd]
        b1: np.ndarray,   # [4 * n_embd]
        W2: np.ndarray,   # [4 * n_embd, n_embd]
        b2: np.ndarray,   # [n_embd]
    ) -> np.ndarray:      # [B, T, n_embd]
        """Two-layer feed-forward network with ReLU activation.

        FFN(x) = ReLU(x @ W1 + b1) @ W2 + b2
        (Linear → ReLU → Linear, hidden dim = 4 * n_embd)
        """
        raise NotImplementedError("Implement feed_forward")

    def layer_norm(
        x:     np.ndarray,   # [..., n_embd]  (any leading dims)
        gamma: np.ndarray,   # [n_embd]
        beta:  np.ndarray,   # [n_embd]
        eps:   float = 1e-5,
    ) -> np.ndarray:          # same shape as x
        """Layer normalization applied over the last axis.

        Steps:
          1. mean = x.mean(axis=-1, keepdims=True)
          2. var  = x.var(axis=-1, keepdims=True)
          3. xhat = (x - mean) / sqrt(var + eps)
          4. return gamma * xhat + beta
        """
        raise NotImplementedError("Implement layer_norm")

    def transformer_block(
        x:          np.ndarray,   # [B, T, n_embd]
        heads:      list,         # list of (Wq, Wk, Wv) tuples
        W_out:      np.ndarray,   # [n_embd, n_embd]
        W1: np.ndarray, b1: np.ndarray,   # FFN first layer
        W2: np.ndarray, b2: np.ndarray,   # FFN second layer
        ln1_gamma:  np.ndarray,   # [n_embd]
        ln1_beta:   np.ndarray,   # [n_embd]
        ln2_gamma:  np.ndarray,   # [n_embd]
        ln2_beta:   np.ndarray,   # [n_embd]
    ) -> np.ndarray:               # [B, T, n_embd]
        """One transformer block: pre-norm attention + pre-norm FFN, both with residual.

        x = x + multi_head_attention(layer_norm(x, ln1_gamma, ln1_beta), heads, W_out)
        x = x + feed_forward(layer_norm(x, ln2_gamma, ln2_beta), W1, b1, W2, b2)
        return x
        """
        raise NotImplementedError("Implement transformer_block")

    # --- student: end ---
    return (feed_forward, layer_norm, transformer_block)


@app.cell
def _(feed_forward, layer_norm, mo, np, _scaffold_attention_head):
    # (scaffold attention fns available from scaffold cell via marimo dependency)

    def _oracle_ff(x, W1, b1, W2, b2):
        return np.maximum(0, x @ W1 + b1) @ W2 + b2

    def _oracle_ln(x, gamma, beta, eps=1e-5):
        mean = x.mean(-1, keepdims=True)
        var  = x.var(-1, keepdims=True)
        return gamma * (x - mean) / np.sqrt(var + eps) + beta

    _solved = False
    try:
        rng = np.random.default_rng(2)
        B, T, n_embd, num_heads, head_size = 2, 4, 8, 2, 4
        hidden = 4 * n_embd

        x = rng.standard_normal((B, T, n_embd))

        # --- layer_norm check ---
        gamma = rng.standard_normal(n_embd)
        beta  = rng.standard_normal(n_embd)
        _ln_out = layer_norm(x, gamma, beta)
        _ln_exp = _oracle_ln(x, gamma, beta)
        assert _ln_out.shape == x.shape, f"layer_norm shape mismatch: {_ln_out.shape}"
        assert np.allclose(_ln_out, _ln_exp, atol=1e-6), \
            f"layer_norm values differ: max err {np.abs(_ln_out - _ln_exp).max():.2e}"

        # --- feed_forward check ---
        W1 = rng.standard_normal((n_embd, hidden)) * 0.1
        b1 = rng.standard_normal(hidden) * 0.1
        W2 = rng.standard_normal((hidden, n_embd)) * 0.1
        b2 = rng.standard_normal(n_embd) * 0.1
        _ff_out = feed_forward(x, W1, b1, W2, b2)
        _ff_exp = _oracle_ff(x, W1, b1, W2, b2)
        assert _ff_out.shape == (B, T, n_embd), f"feed_forward shape: {_ff_out.shape}"
        assert np.allclose(_ff_out, _ff_exp, atol=1e-6), \
            f"feed_forward values differ: max err {np.abs(_ff_out - _ff_exp).max():.2e}"

        # --- transformer_block check ---
        heads = [(rng.standard_normal((n_embd, head_size)) * 0.1,
                  rng.standard_normal((n_embd, head_size)) * 0.1,
                  rng.standard_normal((n_embd, head_size)) * 0.1)
                 for _ in range(num_heads)]
        W_out = rng.standard_normal((n_embd, n_embd)) * 0.1
        ln1g  = rng.standard_normal(n_embd); ln1b = rng.standard_normal(n_embd)
        ln2g  = rng.standard_normal(n_embd); ln2b = rng.standard_normal(n_embd)

        _tb_out = transformer_block(x, heads, W_out, W1, b1, W2, b2,
                                    ln1g, ln1b, ln2g, ln2b)

        # Oracle uses scaffold implementations
        def _oracle_mha(x_, heads_, Wout_):
            outs = [_scaffold_attention_head(x_, Wq, Wk, Wv)
                    for Wq, Wk, Wv in heads_]
            return np.concatenate(outs, axis=-1) @ Wout_

        _tmp = x + _oracle_mha(_oracle_ln(x, ln1g, ln1b), heads, W_out)
        _tb_exp = _tmp + _oracle_ff(_oracle_ln(_tmp, ln2g, ln2b), W1, b1, W2, b2)

        assert _tb_out.shape == (B, T, n_embd), f"transformer_block shape: {_tb_out.shape}"
        assert np.allclose(_tb_out, _tb_exp, atol=1e-5), \
            f"transformer_block values differ: max err {np.abs(_tb_out - _tb_exp).max():.2e}"

        _result = mo.callout(mo.md(
            "✅ `layer_norm`, `feed_forward`, and `transformer_block` all correct!"
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
        for _fn in (feed_forward, layer_norm, transformer_block,):
            try:
                _srcs.append(_inspect.getsource(_fn))
            except Exception:
                pass
        _payload = _json.dumps({"notebookId": "transformers/transformer_block",
                                "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps(
                {"type": "mlp:notebook-solved",
                 "notebookId": "transformers/transformer_block"})))
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
