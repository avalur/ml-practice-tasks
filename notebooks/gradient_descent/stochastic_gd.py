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
    # Stochastic Gradient Descent

    Instead of computing the gradient over all $\ell$ samples, SGD uses a random
    **mini-batch** of size $b$ at each step:

    $$w_{k+1} = w_k - \eta_k\, \nabla_w q_{i_k}(w_k)$$

    where $i_k$ is a randomly drawn batch of indices and:

    $$\nabla_w q_{i_k}(w) = \frac{2}{b}\, X_{i_k}^\top \bigl(X_{i_k} w - y_{i_k}\bigr)$$

    This is noisier than full GD but much cheaper per step.
    """)
    return


@app.cell
def _(np):
    # --- student: begin ---

    def sgd_gradient(X: np.ndarray, y: np.ndarray, w: np.ndarray,
                     batch_size: int, rng: np.random.Generator) -> np.ndarray:
        """
        Sample a random mini-batch of `batch_size` rows from X, y,
        and return the gradient of MSE on that mini-batch.
        Use `rng.choice(len(X), size=batch_size, replace=False)` to pick indices.
        """
        raise NotImplementedError("Implement sgd_gradient")

    # --- student: end ---
    return sgd_gradient,


@app.cell(hide_code=True)
def _(mo, np, sgd_gradient):
    rng = np.random.default_rng(7)
    X = rng.standard_normal((80, 3))
    w_true = np.array([1.0, -1.5, 2.0])
    y = X @ w_true + 0.1 * rng.standard_normal(80)
    w_sgd = np.zeros(3)

    _solved = False
    try:
        g = sgd_gradient(X, y, w_sgd, batch_size=16, rng=np.random.default_rng(0))
        assert g.shape == (3,), f"gradient shape: expected (3,), got {g.shape}"
        assert not np.allclose(g, 0), "gradient is all zeros — check batch sampling"

        # Verify it matches manual mini-batch computation
        rng_check = np.random.default_rng(99)
        idx = rng_check.choice(len(X), size=8, replace=False)
        g_manual = 2 / 8 * X[idx].T @ (X[idx] @ w_sgd - y[idx])
        g_auto   = sgd_gradient(X, y, w_sgd, batch_size=8, rng=np.random.default_rng(99))
        assert np.allclose(g_auto, g_manual, rtol=1e-5), \
            "gradient does not match manual mini-batch computation"

        # Run SGD and check convergence
        w_cur = np.zeros(3)
        for k in range(2000):
            eta = 0.3 * (1 / (1 + k)) ** 0.5
            g_k = sgd_gradient(X, y, w_cur, batch_size=16, rng=rng)
            w_cur -= eta * g_k
        loss = float(np.mean((X @ w_cur - y) ** 2))
        assert loss < 0.05, f"SGD did not converge: MSE={loss:.4f}"

        _result = mo.callout(mo.md(
            f"✅ SGD correct! After 2000 steps: MSE = {loss:.5f}, "
            f"w ≈ {np.round(w_cur, 3)}"
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
        for _fn in (sgd_gradient,):
            try:
                _srcs.append(_inspect.getsource(_fn))
            except Exception:
                pass
        _payload = _json.dumps({"notebookId": "gradient_descent/stochastic_gd", "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps({"type": "mlp:notebook-solved", "notebookId": "gradient_descent/stochastic_gd"})))
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
