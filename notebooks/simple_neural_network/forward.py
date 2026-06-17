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
    # Forward Pass

    Implement the **sigmoid** activation and the **forward pass** of the network.

    ## Sigmoid

    $$\sigma(x) = \frac{1}{1 + e^{-x}}$$

    ## Forward pass

    Given input matrix $X$ of shape $(\text{batch}, 2)$:

    $$a_h = \sigma(X W_h + b_h) \quad \in \mathbb{R}^{\text{batch} \times 2}$$
    $$\hat y = \sigma(a_h W_o + b_o) \quad \in \mathbb{R}^{\text{batch} \times 1}$$

    Use `np.dot` for the matrix multiplications.
    """)
    return


@app.cell
def _(np):
    # ── Reference architecture (don't change) ────────────────────────────────
    class NeuralNetworkBase:
        def __init__(self, input_size=2, hidden_size=2, output_size=1, seed=0):
            rng = np.random.default_rng(seed)
            self.hidden_weights  = rng.standard_normal((input_size, hidden_size))
            self.hidden_bias     = np.zeros(hidden_size)
            self.output_weights  = rng.standard_normal((hidden_size, output_size))
            self.output_bias     = np.zeros(output_size)
            self.hidden_outputs  = None
            self.predicted_outputs = None
    return NeuralNetworkBase,


@app.cell
def _(NeuralNetworkBase, np):
    # ── Your implementation ───────────────────────────────────────────────────

    def sigmoid(x: np.ndarray) -> np.ndarray:
        """σ(x) = 1 / (1 + exp(−x))"""
        raise NotImplementedError("Implement sigmoid")


    class ForwardNN(NeuralNetworkBase):
        def forward(self, inputs: np.ndarray) -> np.ndarray:
            """
            Forward pass. Store intermediate results:
              self.hidden_outputs    — shape (batch, hidden_size)
              self.predicted_outputs — shape (batch, output_size)
            Return self.predicted_outputs.
            """
            raise NotImplementedError("Implement ForwardNN.forward")

    # ─────────────────────────────────────────────────────────────────────────
    return ForwardNN, sigmoid


@app.cell
def _(ForwardNN, mo, np, sigmoid):
    try:
        # Test sigmoid
        x = np.array([-2.0, 0.0, 2.0])
        s = sigmoid(x)
        expected_s = np.array([0.1192, 0.5000, 0.8808])
        assert s.shape == x.shape, "sigmoid must preserve shape"
        assert np.allclose(s, expected_s, atol=1e-4), f"sigmoid values wrong: {s}"
        assert np.all((s >= 0) & (s <= 1)), "sigmoid must output values in [0, 1]"

        # Test forward pass
        nn = ForwardNN(2, 2, 1, seed=42)
        X_test = np.array([[0, 0], [0, 1], [1, 0], [1, 1]], dtype=float)
        out = nn.forward(X_test)

        assert out.shape == (4, 1), f"output shape: expected (4, 1), got {out.shape}"
        assert np.all((out >= 0) & (out <= 1)), "outputs must be in [0, 1] (sigmoid)"
        assert nn.hidden_outputs is not None, "must store hidden_outputs"
        assert nn.hidden_outputs.shape == (4, 2), \
            f"hidden_outputs shape: expected (4, 2), got {nn.hidden_outputs.shape}"

        # Verify manually
        expected_h = sigmoid(X_test @ nn.hidden_weights + nn.hidden_bias)
        assert np.allclose(nn.hidden_outputs, expected_h, rtol=1e-5), \
            "hidden_outputs do not match expected"
        expected_out = sigmoid(expected_h @ nn.output_weights + nn.output_bias)
        assert np.allclose(out, expected_out, rtol=1e-5), \
            "predicted_outputs do not match expected"

        _result = mo.callout(mo.md(
            f"✅ sigmoid and forward pass correct!\n\n"
            f"Output on XOR inputs: {out.ravel().round(3)}"
        ), kind="success")
        try:
            from pyodide.ffi import to_js
            import js as _js
            _js.window.parent.postMessage(
                to_js({"type": "mlp:notebook-solved", "notebookId": "simple_neural_network/forward"}),
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
