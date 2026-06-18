import marimo

__generated_with = "0.23.9"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import numpy as np
    return mo, np


@app.cell
def _(mo):
    mo.md(r"""
    # Momentum Descent

    Momentum adds a **velocity** term $h$ that accumulates past gradients,
    smoothing out oscillations and accelerating convergence:

    $$h_0 = 0$$
    $$h_{k+1} = \alpha\, h_k + \eta_k\, \nabla Q(w_k)$$
    $$w_{k+1} = w_k - h_{k+1}$$

    Typical value: $\alpha = 0.9$.
    """)
    return


@app.cell
def _(np):
    # ── Your implementation ───────────────────────────────────────────────────

    def momentum_step(X: np.ndarray, y: np.ndarray, w: np.ndarray,
                      h: np.ndarray, eta: float, alpha: float = 0.9
                      ) -> tuple[np.ndarray, np.ndarray]:
        """
        One momentum step.
        Returns (new_w, new_h).
        """
        raise NotImplementedError("Implement momentum_step")

    # ─────────────────────────────────────────────────────────────────────────
    return momentum_step,


@app.cell
def _(mo, momentum_step, np):
    rng = np.random.default_rng(3)
    X = rng.standard_normal((60, 2))
    w_true = np.array([3.0, -1.0])
    y = X @ w_true + 0.05 * rng.standard_normal(60)

    try:
        w0 = np.zeros(2)
        h0 = np.zeros(2)
        g0 = 2 / len(X) * X.T @ (X @ w0 - y)
        eta0 = 0.5

        w1, h1 = momentum_step(X, y, w0, h0, eta=eta0, alpha=0.9)
        expected_h1 = 0.9 * h0 + eta0 * g0
        expected_w1 = w0 - expected_h1
        assert np.allclose(h1, expected_h1, rtol=1e-5), "h update incorrect"
        assert np.allclose(w1, expected_w1, rtol=1e-5), "w update incorrect"

        # Check second step uses accumulated h
        g1 = 2 / len(X) * X.T @ (X @ w1 - y)
        eta1 = 0.5 * (1/2)**0.5
        w2, h2 = momentum_step(X, y, w1, h1, eta=eta1, alpha=0.9)
        expected_h2 = 0.9 * h1 + eta1 * g1
        assert np.allclose(h2, expected_h2, rtol=1e-5), "h not accumulated across steps"

        # Convergence check
        w_cur, h_cur = np.zeros(2), np.zeros(2)
        for k in range(300):
            eta = 0.5 * (1/(1+k))**0.5
            w_cur, h_cur = momentum_step(X, y, w_cur, h_cur, eta=eta)
        loss = float(np.mean((X @ w_cur - y)**2))
        assert loss < 0.01, f"did not converge: MSE={loss:.4f}"

        _result = mo.callout(mo.md(
            f"✅ Momentum correct! 300 steps → MSE = {loss:.5f}, "
            f"w ≈ {np.round(w_cur, 3)}"
        ), kind="success")
        try:
            from pyodide.ffi import to_js as _to_js
            import json as _json, js as _js
            _nb_data = _json.dumps({"type": "mlp:notebook-solved", "notebookId": "gradient_descent/momentum"})
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_nb_data))
            _ch.close()
            _js.fetch(
                "/api/notebook-progress",
                _to_js({"method": "POST",
                         "headers": {"Content-Type": "application/json"},
                         "credentials": "include",
                         "body": _nb_data},
                        dict_converter=_js.Object.fromEntries),
            )
        except Exception:
            pass  # not running in Pyodide WASM
    except NotImplementedError as e:
        _result = mo.callout(mo.md(f"✏️ {e}"), kind="neutral")
    except Exception as e:
        _result = mo.callout(mo.md(f"❌ {e}"), kind="danger")
    mo.output.replace(_result)
    return


if __name__ == "__main__":
    app.run()
