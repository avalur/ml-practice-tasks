import marimo

__generated_with = "0.23.9"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import math
    return math, mo


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    # Autograd: Backward Pass

    Now we complete the `Value` class with **automatic differentiation**.
    Each operation records a `_backward` closure that propagates gradients
    from the output back to its inputs.

    The `backward()` method performs a topological sort of the computation
    graph and then sweeps in reverse, calling `_backward()` on every node.

    Key methods to implement:
    - `grad` — accumulated gradient (starts at 0.0, defaults)
    - `_backward()` — per-operation gradient propagation (overridden in each op's result)
    - `backward()` — topological sort + reverse sweep
    """)
    return


@app.cell
def _(math):
    # --- student: begin ---

    class Value:
        def __init__(self, data, _children=(), _op='', label=''):
            """Wrap a scalar; record the computation graph node."""
            raise NotImplementedError("Implement Value.__init__")

        def __repr__(self):
            return f"Value(label={self.label}, data={self.data})"

        def __add__(self, other):
            raise NotImplementedError("Implement __add__")

        def __mul__(self, other):
            raise NotImplementedError("Implement __mul__")

        def __pow__(self, other):
            raise NotImplementedError("Implement __pow__")

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
            raise NotImplementedError("Implement tanh")

        def exp(self):
            raise NotImplementedError("Implement exp")

        # --- new: backward pass ---
        def _backward(self):
            raise NotImplementedError("Implement _backward")

        def backward(self):
            raise NotImplementedError("Implement backward")

    # --- student: end ---
    return (Value,)


@app.cell
def _(mo, Value):
    _solved = False
    try:
        # Forward pass from the source test
        x1, x2 = Value(2.0), Value(0.0)
        w1, w2 = Value(-3.0), Value(1.0)
        c = Value(6.8813139)

        # x1*w1 + x2*w2 + c
        n = (x1 * w1) + (x2 * w2) + c
        # tanh → output
        o = n.tanh()

        # Backward pass
        o.backward()

        expected_grads = {
            'x1': -1.5,
            'w1': 1.0,
            'x2': 0.5,
            'w2': 0.0,
        }

        for name, expected in expected_grads.items():
            actual = getattr(globals()[name], 'grad', None)
            assert actual is not None, f"{name} has no grad attribute"
            assert abs(actual - expected) < 1e-10, \
                f"{name}.grad should be {expected}, got {actual}"

        _result = mo.callout(mo.md("✅ Forward pass and backward pass are correct!"), kind="success")
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
        for _fn in (Value,):
            try:
                _srcs.append(_inspect.getsource(_fn))
            except Exception:
                pass
        _payload = _json.dumps({"notebookId": "backprop_mlp/autograd", "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps({"type": "mlp:notebook-solved", "notebookId": "backprop_mlp/autograd"})))
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
