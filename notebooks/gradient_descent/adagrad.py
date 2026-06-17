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
    # Adagrad

    **Adaptive Gradient Algorithm** adjusts the learning rate *per parameter*
    based on the accumulated squared gradients $G$:

    $$G_0 = 0$$
    $$G_{k+1} = G_k + \bigl(\nabla Q(w_k)\bigr)^2$$
    $$w_{k+1} = w_k - \frac{\eta_k}{\sqrt{\varepsilon + G_{k+1}}}\,\nabla Q(w_k)$$

    Note: $G_k$ is a **vector** (same shape as $w$); division is element-wise.
    Typical: $\varepsilon = 10^{-8}$.
    """)
    return


@app.cell
def _(np):
    # ── Your implementation ───────────────────────────────────────────────────

    def adagrad_step(X: np.ndarray, y: np.ndarray, w: np.ndarray,
                     G: np.ndarray, eta: float, eps: float = 1e-8
                     ) -> tuple[np.ndarray, np.ndarray]:
        """
        One Adagrad step.
        Returns (new_w, new_G).
        """
        raise NotImplementedError("Implement adagrad_step")

    # ─────────────────────────────────────────────────────────────────────────
    return adagrad_step,


@app.cell
def _(adagrad_step, mo, np):
    rng = np.random.default_rng(5)
    X = rng.standard_normal((50, 3))
    w_true = np.array([1.0, -2.0, 1.5])
    y = X @ w_true + 0.05 * rng.standard_normal(50)

    try:
        w0 = np.zeros(3)
        G0 = np.zeros(3)
        grad0 = 2 / len(X) * X.T @ (X @ w0 - y)
        eta0 = 0.5

        w1, G1 = adagrad_step(X, y, w0, G0, eta=eta0)
        expected_G1 = G0 + grad0 ** 2
        expected_w1 = w0 - eta0 / np.sqrt(1e-8 + expected_G1) * grad0
        assert G1.shape == (3,), f"G shape: expected (3,), got {G1.shape}"
        assert np.allclose(G1, expected_G1, rtol=1e-5), "G accumulation incorrect"
        assert np.allclose(w1, expected_w1, rtol=1e-5), "w update incorrect"

        # Verify G is monotonically non-decreasing
        G_cur = np.zeros(3)
        w_cur = np.zeros(3)
        for k in range(500):
            eta = 0.5 * (1/(1+k))**0.5
            G_prev = G_cur.copy()
            w_cur, G_cur = adagrad_step(X, y, w_cur, G_cur, eta=eta)
            assert np.all(G_cur >= G_prev - 1e-10), "G must be non-decreasing"
        loss = float(np.mean((X @ w_cur - y)**2))
        assert loss < 0.01, f"did not converge: MSE={loss:.4f}"

        mo.callout(mo.md(
            f"✅ Adagrad correct! 500 steps → MSE = {loss:.5f}, "
            f"w ≈ {np.round(w_cur, 3)}"
        ), kind="success")
        try:
            from pyodide.ffi import to_js
            import js as _js
            _js.window.parent.postMessage(
                to_js({"type": "mlp:notebook-solved", "notebookId": "gradient_descent/adagrad"}),
                "*",
            )
        except Exception:
            pass  # not running in Pyodide WASM
    except NotImplementedError as e:
        mo.callout(mo.md(f"✏️ {e}"), kind="neutral")
    except Exception as e:
        mo.callout(mo.md(f"❌ {e}"), kind="danger")
    return


if __name__ == "__main__":
    app.run()
