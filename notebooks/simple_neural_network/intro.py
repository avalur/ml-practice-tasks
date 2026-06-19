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
    # Two-Layer Neural Network from Scratch

    Build a **fully connected neural network** using only NumPy — no PyTorch.

    ## Architecture

    ```
    Input (2)  →  Hidden (2) [sigmoid]  →  Output (1) [sigmoid]
    ```

    ## Parameters

    | Symbol | Shape | Description |
    |---|---|---|
    | $W_h$ | (2, 2) | input → hidden weights |
    | $b_h$ | (2,)   | hidden bias |
    | $W_o$ | (2, 1) | hidden → output weights |
    | $b_o$ | (1,)   | output bias |

    ## Forward pass

    $$z_h = X W_h + b_h, \quad a_h = \sigma(z_h)$$
    $$z_o = a_h W_o + b_o, \quad \hat y = \sigma(z_o)$$

    ## Loss (MSE)

    $$\mathcal{L} = \frac{1}{2}\|\hat y - y\|^2$$

    In this notebook, implement the `NeuralNetwork` **base class** with random weight
    initialisation. The forward pass and backprop come in the next notebooks.
    """)
    return


@app.cell
def _(np):
    # --- student: begin ---

    class NeuralNetwork:
        def __init__(self, input_size: int = 2, hidden_size: int = 2,
                     output_size: int = 1, seed: int = 0):
            """
            Initialise weights randomly (use np.random.default_rng(seed)).
            Initialise biases to zeros.

            Attributes to set:
              self.hidden_weights  — shape (input_size, hidden_size)
              self.hidden_bias     — shape (hidden_size,)
              self.output_weights  — shape (hidden_size, output_size)
              self.output_bias     — shape (output_size,)
            """
            raise NotImplementedError("Implement NeuralNetwork.__init__")

    # --- student: end ---
    return NeuralNetwork,


@app.cell(hide_code=True)
def _(NeuralNetwork, mo, np):
    _solved = False
    try:
        nn = NeuralNetwork(2, 2, 1, seed=42)

        assert hasattr(nn, "hidden_weights"),  "missing hidden_weights"
        assert hasattr(nn, "hidden_bias"),     "missing hidden_bias"
        assert hasattr(nn, "output_weights"),  "missing output_weights"
        assert hasattr(nn, "output_bias"),     "missing output_bias"

        assert nn.hidden_weights.shape  == (2, 2), f"hidden_weights shape: {nn.hidden_weights.shape}"
        assert nn.hidden_bias.shape     == (2,),   f"hidden_bias shape: {nn.hidden_bias.shape}"
        assert nn.output_weights.shape  == (2, 1), f"output_weights shape: {nn.output_weights.shape}"
        assert nn.output_bias.shape     == (1,),   f"output_bias shape: {nn.output_bias.shape}"

        assert np.allclose(nn.hidden_bias,  0), "hidden_bias should be initialised to zeros"
        assert np.allclose(nn.output_bias,  0), "output_bias should be initialised to zeros"
        assert not np.allclose(nn.hidden_weights, 0), "hidden_weights should be random, not zeros"

        _result = mo.callout(mo.md("✅ NeuralNetwork initialised correctly!"), kind="success")
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
        for _fn in (NeuralNetwork,):
            try:
                _srcs.append(_inspect.getsource(_fn))
            except Exception:
                pass
        _payload = _json.dumps({"notebookId": "simple_neural_network/intro", "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps({"type": "mlp:notebook-solved", "notebookId": "simple_neural_network/intro"})))
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
