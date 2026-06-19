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
    # Backpropagation

    Implement the **backpropagation** algorithm for the two-layer network.

    ## Loss (MSE)

    $$\mathcal{L} = \frac{1}{2}(\hat y - y)^2$$

    ## Gradients (chain rule)

    Let $\hat y = \sigma(z_o)$ and $a_h = \sigma(z_h)$:

    | Gradient | Formula |
    |---|---|
    | $\partial\mathcal{L}/\partial z_o$ | $(\hat y - y)\cdot\sigma'(\hat y)$ |
    | $\partial\mathcal{L}/\partial W_o$ | $a_h^\top \cdot \delta_o$ |
    | $\partial\mathcal{L}/\partial b_o$ | $\sum \delta_o$ |
    | $\delta_h$ | $(\delta_o W_o^\top)\cdot\sigma'(a_h)$ |
    | $\partial\mathcal{L}/\partial W_h$ | $X^\top \cdot \delta_h$ |
    | $\partial\mathcal{L}/\partial b_h$ | $\sum \delta_h$ |

    where $\sigma'(a) = a(1-a)$ (derivative at the **output** of sigmoid, not input).

    **Update rule:** $\theta \leftarrow \theta - \text{lr} \cdot \nabla_\theta$
    """)
    return


@app.cell
def _(np):
    def sigmoid(x):
        return 1 / (1 + np.exp(-x))

    def sigmoid_derivative(a):
        """Derivative at sigmoid output: a*(1−a)"""
        return a * (1 - a)

    class NeuralNetworkBase:
        def __init__(self, input_size=2, hidden_size=2, output_size=1, seed=0):
            rng = np.random.default_rng(seed)
            self.hidden_weights   = rng.standard_normal((input_size, hidden_size))
            self.hidden_bias      = np.zeros(hidden_size)
            self.output_weights   = rng.standard_normal((hidden_size, output_size))
            self.output_bias      = np.zeros(output_size)
            self.hidden_outputs   = None
            self.predicted_outputs = None

        def forward(self, inputs):
            self.hidden_outputs    = sigmoid(inputs @ self.hidden_weights + self.hidden_bias)
            self.predicted_outputs = sigmoid(self.hidden_outputs @ self.output_weights + self.output_bias)
            return self.predicted_outputs
    return NeuralNetworkBase, sigmoid, sigmoid_derivative


@app.cell
def _(NeuralNetworkBase, np, sigmoid_derivative):
    # --- student: begin ---

    class Backpropagation(NeuralNetworkBase):
        def train(self, inputs: np.ndarray, targets: np.ndarray,
                  epochs: int, lr: float) -> np.ndarray:
            """
            Train the network for `epochs` epochs.
            After each forward pass, compute gradients via backprop and
            update all weights and biases.
            Return the final predicted outputs.
            """
            raise NotImplementedError("Implement Backpropagation.train")

    # --- student: end ---
    return Backpropagation,


@app.cell(hide_code=True)
def _(Backpropagation, mo, np):
    # XOR dataset
    inputs  = np.array([[0,0],[0,1],[1,0],[1,1]], dtype=float)
    targets = np.array([[0],[1],[1],[0]], dtype=float)

    _solved = False
    try:
        model = Backpropagation(2, 2, 1, seed=0)
        preds = model.train(inputs, targets, epochs=10_000, lr=0.5)

        assert preds.shape == (4, 1), f"output shape: expected (4, 1), got {preds.shape}"

        mse = float(np.mean((preds - targets) ** 2))
        assert mse < 0.05, \
            f"MSE {mse:.4f} too high — did backprop converge? (XOR needs ~10 000 epochs)"

        classified = (preds > 0.5).astype(int)
        correct = int(np.sum(classified == targets))
        assert correct == 4, f"only {correct}/4 correct — check weight updates"

        _result = mo.callout(mo.md(
            f"✅ Backprop correct! {correct}/4 XOR samples classified right, "
            f"MSE = {mse:.5f}\n\n"
            f"Predictions: {preds.ravel().round(3)}"
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
        for _fn in (Backpropagation,):
            try:
                _srcs.append(_inspect.getsource(_fn))
            except Exception:
                pass
        _payload = _json.dumps({"notebookId": "simple_neural_network/backpropagation", "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps({"type": "mlp:notebook-solved", "notebookId": "simple_neural_network/backpropagation"})))
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
