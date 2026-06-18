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
    # Multi-Head Attention

    Now we combine multiple attention heads. Each head learns different
    projection patterns, and their outputs are concatenated and projected.

    Below is the **working `attention_head`** from the previous notebook,
    provided as a scaffold. You may read it for reference — do not modify it.

    ## Task

    Implement `multi_head_attention(x, heads, W_out)` that:
    1. Runs each head independently via `attention_head`
    2. Concatenates all head outputs along the last axis
    3. Projects through `W_out` to get final output
    """)
    return


@app.cell
def _(np):
    """Working attention_head — provided as scaffold for multi-head notebook."""
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
    return (_scaffold_attention_head,)


@app.cell
def _(mo):
    mo.md("## Task — implement `multi_head_attention`")
    return


@app.cell
def _(mo):
    # --- student: begin ---

    def multi_head_attention(
        x:      np.ndarray,         # [B, T, n_embd]
        heads:  list,               # list of (Wq, Wk, Wv) tuples, each [n_embd, head_size]
        W_out:  np.ndarray,         # [n_embd, n_embd]   (n_embd = num_heads * head_size)
    ) -> np.ndarray:                # [B, T, n_embd]
        """Run num_heads attention heads in parallel, concatenate, project.

        Steps:
          1. For each (Wq, Wk, Wv) in heads: compute attention_head(x, Wq, Wk, Wv)
             → each output has shape [B, T, head_size]
          2. Concatenate along last axis → [B, T, n_embd]  (n_embd = num_heads * head_size)
          3. Project through W_out: result @ W_out  → [B, T, n_embd]
        """
        raise NotImplementedError("Implement multi_head_attention")

    # --- student: end ---
    return (multi_head_attention,)


@app.cell
def _(mo, multi_head_attention, np):
    # Oracle using scaffold attention head
    def _oracle_mha(x, heads, W_out, _attn_fn):
        head_outs = [_attn_fn(x, Wq, Wk, Wv) for Wq, Wk, Wv in heads]
        cat = np.concatenate(head_outs, axis=-1)   # [B, T, n_embd]
        return cat @ W_out                          # [B, T, n_embd]

    _solved = False
    try:
        rng = np.random.default_rng(1)
        B, T, n_embd, num_heads, head_size = 2, 5, 8, 2, 4
        x     = rng.standard_normal((B, T, n_embd))
        heads = [(rng.standard_normal((n_embd, head_size)) * 0.1,
                  rng.standard_normal((n_embd, head_size)) * 0.1,
                  rng.standard_normal((n_embd, head_size)) * 0.1)
                 for _ in range(num_heads)]
        W_out = rng.standard_normal((n_embd, n_embd)) * 0.1

        out = multi_head_attention(x, heads, W_out)
        exp = _oracle_mha(x, heads, W_out, _scaffold_attention_head)

        assert out.shape == (B, T, n_embd), \
            f"shape: expected {(B, T, n_embd)}, got {out.shape}"
        assert np.allclose(out, exp, atol=1e-6), \
            f"values differ: max diff = {np.abs(out - exp).max():.2e}"

        _result = mo.callout(mo.md(
            f"✅ `multi_head_attention` correct!  shape {out.shape},  "
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
        for _fn in (multi_head_attention,):
            try:
                _srcs.append(_inspect.getsource(_fn))
            except Exception:
                pass
        _payload = _json.dumps({"notebookId": "transformers/multi_head",
                                "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps(
                {"type": "mlp:notebook-solved", "notebookId": "transformers/multi_head"})))
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
