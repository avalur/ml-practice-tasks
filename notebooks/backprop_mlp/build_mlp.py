import marimo

__generated_with = "0.23.9"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import math
    import random
    import numpy as np
    return math, mo, random, np


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    # Building an MLP

    Now that we have a working autograd engine (`Value`), let's build neural
    network primitives on top of it.

    Below is the **complete reference `Value` class** (forward + backward).
    Use it as a building block — do not modify it.

    Your task: implement `Neuron`, `Layer`, and `MLP` classes that compose
    `Value` objects into a multi-layer perceptron.
    """)
    return


@app.cell
def _(math, random):
    # --- reference Value class (do not modify) ---

    class Value:
        def __init__(self, data, _children=(), _op='', label=''):
            self.data = data
            self.grad = 0.0
            self._label = label
            self._prev = set(_children)
            self._op = _op

        def __repr__(self):
            return f"Value(label={self._label}, data={self.data})"

        def __add__(self, other):
            other = other if isinstance(other, Value) else Value(other)
            out = Value(self.data + other.data, (self, other), '+')
            def _backward():
                self.grad += out.grad
                other.grad += out.grad
            out._backward = _backward
            return out

        def __mul__(self, other):
            other = other if isinstance(other, Value) else Value(other)
            out = Value(self.data * other.data, (self, other), '*')
            def _backward():
                self.grad += other.data * out.grad
                other.grad += self.data * out.grad
            out._backward = _backward
            return out

        def __pow__(self, other):
            assert isinstance(other, (int, float)), "powering to a non-integer is not supported"
            out = Value(self.data ** other, (self,), f'**{other}')
            def _backward():
                self.grad += other * (self.data ** (other - 1)) * out.grad
            out._backward = _backward
            return out

        def __neg__(self):
            return self * -1

        def __sub__(self, other):
            return self + (-other)

        def __truediv__(self, other):
            return self * other ** -1

        def __radd__(self, other):
            return self + other

        def __rsub__(self, other):
            return other + (-self)

        def __rmul__(self, other):
            return self * other

        def __rtruediv__(self, other):
            return other * self ** -1

        def tanh(self):
            t = math.tanh(self.data)
            out = Value(t, (self,), 'tanh')
            def _backward():
                out.grad += (1 - t**2) * self.grad
            # Fix: propagate to self, not out
            def _backward_fixed():
                self.grad += (1 - t**2) * out.grad
            out._backward = _backward_fixed
            return out

        def exp(self):
            e = math.exp(self.data)
            out = Value(e, (self,), 'exp')
            def _backward():
                self.grad += out.data * out.grad
            out._backward = _backward
            return out

        def _backward(self):
            pass

        def backward(self):
            topo, visited = [], set()
            def build_topo(v):
                if v not in visited:
                    visited.add(v)
                    for child in v._prev:
                        build_topo(child)
                    topo.append(v)
            build_topo(self)
            self.grad = 1.0
            for node in reversed(topo):
                node._backward()

    # --- end reference Value class ---
    return (Value,)


@app.cell
def _(mo, random):
    mo.md("## Task — implement `Neuron`, `Layer`, and `MLP`")
    return


@app.cell
def _(mo, random):
    # --- student: begin ---

    class Neuron:
        def __init__(self, nin):
            """A single neuron with `nin` inputs."""
            raise NotImplementedError("Implement Neuron")

        def __call__(self, x):
            """Compute w·x + b, then tanh."""
            raise NotImplementedError("Implement Neuron.__call__")

        def parameters(self):
            """Return list of all trainable Value parameters."""
            raise NotImplementedError("Implement Neuron.parameters")

    class Layer:
        def __init__(self, nin, nout):
            """A layer of `nout` neurons, each with `nin` inputs."""
            raise NotImplementedError("Implement Layer")

        def __call__(self, x):
            """Forward pass through all neurons in the layer."""
            raise NotImplementedError("Implement Layer.__call__")

        def parameters(self):
            """Return list of all trainable Value parameters in this layer."""
            raise NotImplementedError("Implement Layer.parameters")

    class MLP:
        def __init__(self, nin, nouts):
            """An MLP with layers defined by `nouts` (list of layer sizes)."""
            raise NotImplementedError("Implement MLP")

        def __call__(self, x):
            """Forward pass through all layers."""
            raise NotImplementedError("Implement MLP.__call__")

        def parameters(self):
            """Return list of all trainable Value parameters in the network."""
            raise NotImplementedError("Implement MLP.parameters")

    # --- student: end ---
    return (Neuron, Layer, MLP)


@app.cell(hide_code=True)
def _(mo, np, random, Value):
    _solved = False
    try:
        import random as _random
        _random.seed(42)

        mlp = MLP(2, [3, 1])
        # MLP(2, [3, 1]) has layers: Layer(2,3) and Layer(3,1)
        # Layer(2,3): 3 neurons × (2 weights + 1 bias) = 9 params
        # Layer(3,1): 1 neuron × (3 weights + 1 bias) = 4 params
        # Total: 13 params
        assert len(mlp.parameters()) == 13, f"Expected 13 params, got {len(mlp.parameters())}"
        assert len(mlp.layers) == 2, f"Expected 2 layers"
        assert isinstance(mlp.layers[0], Layer), "First layer should be Layer"

        x = [Value(1.0), Value(2.0)]
        out = mlp(x)
        assert isinstance(out, Value), "Output of MLP(2,[3,1]) should be a single Value"
        out.backward()

        # A forward pass through a 1-output MLP should produce a valid scalar
        assert abs(out.data) <= 1.0, "tanh output should be in [-1, 1]"

        _result = mo.callout(mo.md("✅ MLP is correct!"), kind="success")
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
        for _fn in (Neuron, Layer, MLP,):
            try:
                _srcs.append(_inspect.getsource(_fn))
            except Exception:
                pass
        _payload = _json.dumps({"notebookId": "backprop_mlp/build_mlp", "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps({"type": "mlp:notebook-solved", "notebookId": "backprop_mlp/build_mlp"})))
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
