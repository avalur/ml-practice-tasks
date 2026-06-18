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
    # Linear Regression with Gradient Descent

    Implement a `LinearRegression` class that trains using full batch gradient descent.

    **Requirements:**
    - All calculations must be vectorized (NumPy only, no explicit loops except for GD iterations)
    - Stopping criterion: stop when **both** conditions hold:
      - $\|w_{k+1} - w_k\|^2 < \text{tolerance}$
      - maximum iterations reached
    - Record `loss_history` after each step (starting from $w_0$)

    **Step size schedule:** $\eta_k = \lambda \left(\dfrac{s_0}{s_0 + k}\right)^p$
    """)
    return


@app.cell
def _(np):
    # ── Your implementation ───────────────────────────────────────────────────

    class LinearRegression:
        def __init__(self, lambda_: float = 0.01, s0: float = 1.0,
                     p: float = 0.5, tolerance: float = 1e-4,
                     max_iter: int = 1000):
            self.lambda_ = lambda_
            self.s0 = s0
            self.p = p
            self.tolerance = tolerance
            self.max_iter = max_iter
            self.w = None
            self.loss_history = []

        def eta(self, k: int) -> float:
            """Learning rate at iteration k."""
            return self.lambda_ * (self.s0 / (self.s0 + k)) ** self.p

        def fit(self, X: np.ndarray, y: np.ndarray) -> "LinearRegression":
            """Train using full batch gradient descent."""
            raise NotImplementedError("Implement LinearRegression.fit()")

        def predict(self, X: np.ndarray) -> np.ndarray:
            """Return Xw."""
            raise NotImplementedError("Implement LinearRegression.predict()")

    # ─────────────────────────────────────────────────────────────────────────
    return LinearRegression,


@app.cell
def _(LinearRegression, mo, np):
    rng = np.random.default_rng(42)
    X_tr = rng.standard_normal((100, 3))
    w_true = np.array([1.0, -2.0, 0.5])
    y_tr = X_tr @ w_true + 0.05 * rng.standard_normal(100)

    try:
        model = LinearRegression(lambda_=0.1, max_iter=2000)
        model.fit(X_tr, y_tr)
        assert model.w is not None, "w must be set after fit()"
        assert len(model.loss_history) > 0, "loss_history must not be empty"
        assert model.loss_history[0] >= model.loss_history[-1], \
            "loss should decrease overall"

        preds = model.predict(X_tr)
        assert preds.shape == (100,), f"predict shape: expected (100,), got {preds.shape}"

        final_loss = float(np.mean((preds - y_tr) ** 2))
        assert final_loss < 0.05, f"final MSE {final_loss:.4f} is too high — did GD converge?"

        _result = mo.callout(mo.md(
            f"✅ Converged! Final MSE = **{final_loss:.5f}**, "
            f"{len(model.loss_history)} iterations, "
            f"w ≈ {np.round(model.w, 2)}"
        ), kind="success")
        try:
            import json as _json, js as _js
            _js.window.parent.postMessage(
                _js.JSON.parse(_json.dumps({"type": "mlp:notebook-solved", "notebookId": "gradient_descent/linear_regression"})),
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
