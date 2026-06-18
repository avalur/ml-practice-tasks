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
    # Adagrad with L2 Regularization

    Add an **L2 penalty** $\frac{\mu}{2}\|w\|^2$ to the loss:

    $$Q_\mu(w) = \frac{1}{\ell}\sum_{i=1}^{\ell}(a_w(x_i)-y_i)^2 + \frac{\mu}{2}\|w\|^2$$

    The gradient becomes:

    $$\nabla Q_\mu(w) = \frac{2}{\ell} X^\top(Xw - y) + \mu\, w$$

    Use this regularised gradient inside the Adagrad update rule.
    """)
    return


@app.cell
def _(np):
    # ── Your implementation ───────────────────────────────────────────────────

    def adagrad_l2_step(X: np.ndarray, y: np.ndarray, w: np.ndarray,
                        G: np.ndarray, eta: float, mu: float = 0.01,
                        eps: float = 1e-8) -> tuple[np.ndarray, np.ndarray]:
        """
        Adagrad step with L2 regularization.
        Gradient = 2/ℓ · Xᵀ(Xw−y)  +  μ·w
        Returns (new_w, new_G).
        """
        raise NotImplementedError("Implement adagrad_l2_step")

    # ─────────────────────────────────────────────────────────────────────────
    return adagrad_l2_step,


@app.cell
def _(adagrad_l2_step, mo, np):
    rng = np.random.default_rng(11)
    n, d = 60, 4
    X = rng.standard_normal((n, d))
    w_true = np.array([2.0, -1.0, 0.5, 1.5])
    y = X @ w_true + 0.1 * rng.standard_normal(n)
    mu = 0.1

    try:
        w0 = np.zeros(d)
        G0 = np.zeros(d)
        grad_plain = 2 / n * X.T @ (X @ w0 - y)
        grad_reg   = grad_plain + mu * w0
        eta0 = 0.5

        w1, G1 = adagrad_l2_step(X, y, w0, G0, eta=eta0, mu=mu)
        expected_G1 = G0 + grad_reg ** 2
        expected_w1 = w0 - eta0 / np.sqrt(1e-8 + expected_G1) * grad_reg
        assert np.allclose(G1, expected_G1, rtol=1e-5), "G update incorrect"
        assert np.allclose(w1, expected_w1, rtol=1e-5), "w update incorrect"

        # Check regularisation actually shrinks weights compared to mu=0
        def adagrad_no_reg(X, y, w0, steps=500):
            w, G = w0.copy(), np.zeros(len(w0))
            for k in range(steps):
                eta = 0.5 * (1/(1+k))**0.5
                g = 2/len(X) * X.T @ (X @ w - y)
                G = G + g**2
                w = w - eta / np.sqrt(1e-8 + G) * g
            return w

        w_noreg = adagrad_no_reg(X, y, np.zeros(d))

        w_cur, G_cur = np.zeros(d), np.zeros(d)
        for k in range(500):
            eta = 0.5 * (1/(1+k))**0.5
            w_cur, G_cur = adagrad_l2_step(X, y, w_cur, G_cur, eta=eta, mu=mu)

        assert np.linalg.norm(w_cur) < np.linalg.norm(w_noreg), \
            "Regularized weights should have smaller norm than unregularized"

        _result = mo.callout(mo.md(
            f"✅ Adagrad + L2 correct!\n\n"
            f"‖w‖ with reg = {np.linalg.norm(w_cur):.3f}  "
            f"vs without = {np.linalg.norm(w_noreg):.3f}"
        ), kind="success")
        try:
            import json as _json, js as _js
            _js.window.parent.postMessage(
                _js.JSON.parse(_json.dumps({"type": "mlp:notebook-solved", "notebookId": "gradient_descent/regularization"})),
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
