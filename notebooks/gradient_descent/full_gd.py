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
    # Full Batch Gradient Descent

    Implement the **full GD** weight update:

    $$w_{k+1} = w_k - \eta_k \,\nabla_w Q(w_k)$$

    where the gradient is computed over the **entire** dataset:

    $$\nabla_w Q(w) = \frac{2}{\ell}\, X^\top (Xw - y)$$
    """)
    return


@app.cell
def _(np):
    # ── Your implementation ───────────────────────────────────────────────────

    def calc_gradient(X: np.ndarray, y: np.ndarray, w: np.ndarray) -> np.ndarray:
        """Full-batch MSE gradient: 2/ℓ · Xᵀ(Xw − y)"""
        raise NotImplementedError("Implement calc_gradient")


    def update_weights(w: np.ndarray, gradient: np.ndarray, eta: float) -> np.ndarray:
        """One GD step: return updated w and the weight difference."""
        raise NotImplementedError("Implement update_weights")

    # ─────────────────────────────────────────────────────────────────────────
    return calc_gradient, update_weights


@app.cell
def _(calc_gradient, mo, np, update_weights):
    rng = np.random.default_rng(0)
    X = rng.standard_normal((40, 2))
    w_true = np.array([2.0, -1.0])
    y = X @ w_true + 0.01 * rng.standard_normal(40)
    w = np.zeros(2)

    try:
        g = calc_gradient(X, y, w)
        expected_g = 2 / len(X) * X.T @ (X @ w - y)
        assert g.shape == (2,), f"gradient shape: expected (2,), got {g.shape}"
        assert np.allclose(g, expected_g, rtol=1e-5), "gradient values incorrect"

        w_new = update_weights(w.copy(), g, eta=0.1)
        assert w_new.shape == (2,), f"updated w shape: expected (2,)"
        expected_w = w - 0.1 * g
        assert np.allclose(w_new, expected_w, rtol=1e-5), "update_weights incorrect"

        # Run a few steps manually and check convergence
        w_cur = np.zeros(2)
        for k in range(500):
            eta = 0.5 * (1 / (1 + k)) ** 0.5
            g_k = calc_gradient(X, y, w_cur)
            w_cur = update_weights(w_cur, g_k, eta)
        loss = float(np.mean((X @ w_cur - y) ** 2))
        assert loss < 0.01, f"did not converge: MSE={loss:.4f}"

        _result = mo.callout(mo.md(
            f"✅ Full GD correct! After 500 steps: MSE = {loss:.5f}, "
            f"w ≈ {np.round(w_cur, 3)}"
        ), kind="success")
        try:
            from pyodide.ffi import to_js
            import js as _js
            _js.window.parent.postMessage(
                to_js({"type": "mlp:notebook-solved", "notebookId": "gradient_descent/full_gd"}),
                "*",
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
