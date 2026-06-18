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
    # Gradient Descent: Introduction

    We will train a **linear regression** model $a_w(x) = x^\top w$ by minimising
    the **Mean Squared Error** loss:

    $$Q(w) = \frac{1}{\ell} \sum_{i=1}^{\ell} (a_w(x_i) - y_i)^2$$

    The gradient of $Q$ with respect to $w$ is:

    $$\nabla_w Q(w) = \frac{2}{\ell} X^\top (Xw - y)$$

    Over the next notebooks you will implement four variants:

    | Method | Update rule |
    |---|---|
    | **Full GD** | $w_{k+1} = w_k - \eta_k \nabla Q(w_k)$ |
    | **Stochastic GD** | $w_{k+1} = w_k - \eta_k \nabla q_{i_k}(w_k)$ |
    | **Momentum** | $h_{k+1} = \alpha h_k + \eta_k \nabla Q$, $\;\;w_{k+1} = w_k - h_{k+1}$ |
    | **Adagrad** | $G_{k+1} = G_k + (\nabla Q)^2$, $\;\;w_{k+1} = w_k - \frac{\eta_k}{\sqrt{\varepsilon + G_{k+1}}} \nabla Q$ |

    The learning rate schedule used throughout:
    $$\eta_k = \lambda \left(\frac{s_0}{s_0 + k}\right)^p, \quad s_0=1,\; p=0.5$$
    """)
    return


@app.cell
def _(mo):
    mo.md("## Task — implement `mse_loss` and `mse_gradient`")
    return


@app.cell
def _(np):
    # --- student: begin ---

    def mse_loss(X: np.ndarray, y: np.ndarray, w: np.ndarray) -> float:
        """MSE loss  Q(w) = mean((Xw - y)^2)"""
        raise NotImplementedError("Implement mse_loss")

    def mse_gradient(X: np.ndarray, y: np.ndarray, w: np.ndarray) -> np.ndarray:
        """Gradient of MSE:  ∇Q(w) = 2/ℓ · Xᵀ(Xw − y)"""
        raise NotImplementedError("Implement mse_gradient")

    # --- student: end ---
    return mse_gradient, mse_loss


@app.cell
def _(mo, mse_gradient, mse_loss, np):
    """Checks — reruns automatically when you edit the cells above."""
    rng = np.random.default_rng(0)
    X = rng.standard_normal((50, 3))
    w_true = np.array([1.0, -2.0, 0.5])
    y = X @ w_true + 0.1 * rng.standard_normal(50)
    w = np.zeros(3)

    _solved = False
    try:
        loss = mse_loss(X, y, w)
        assert isinstance(loss, float | np.floating), "mse_loss must return a scalar"
        expected_loss = float(np.mean((X @ w - y) ** 2))
        assert np.isclose(loss, expected_loss, rtol=1e-5), \
            f"mse_loss: expected {expected_loss:.4f}, got {loss:.4f}"

        grad = mse_gradient(X, y, w)
        assert grad.shape == (3,), f"gradient shape should be (3,), got {grad.shape}"
        expected_grad = 2 / len(X) * X.T @ (X @ w - y)
        assert np.allclose(grad, expected_grad, rtol=1e-5), \
            f"mse_gradient: values differ from expected"

        _result = mo.callout(mo.md("✅ Both `mse_loss` and `mse_gradient` are correct!"), kind="success")
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
        for _fn in (mse_gradient, mse_loss,):
            try:
                _srcs.append(_inspect.getsource(_fn))
            except Exception:
                pass
        _payload = _json.dumps({"notebookId": "gradient_descent/intro", "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps({"type": "mlp:notebook-solved", "notebookId": "gradient_descent/intro"})))
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
