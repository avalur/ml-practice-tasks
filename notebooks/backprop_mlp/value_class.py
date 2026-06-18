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
    # Scalar Value Class

    We will build a tiny **autograd engine** inspired by Karpathy's *micrograd*.
    The core is a `Value` object that wraps a single Python float and records
    which operation produced it — building a **computational graph** for the
    forward pass.

    In this notebook you implement the forward pass only.  The next notebook
    adds the backward pass (`backward()` and gradient accumulation).

    Each `Value` stores:
    - `data` — the scalar number
    - `_prev` — the set of input `Value` nodes (parents in the graph)
    - `_op` — string label for the operation that created this node (`'+'`, `'*'`, …)
    - `label` — optional name for debugging

    You must implement the following methods:

    | Method | Description |
    |---|---|
    | `__add__` | `a + b` |
    | `__mul__` | `a * b` |
    | `__pow__` | `a ** n` (n is int or float) |
    | `__neg__`, `__sub__`, `__truediv__` | derived from the above |
    | `__radd__`, `__rmul__`, `__rsub__`, `__rtruediv__` | right-hand versions |
    | `tanh()` | hyperbolic tangent |
    | `exp()` | exponential |
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

    # --- student: end ---
    return (Value,)


@app.cell
def _(Value, mo):
    _solved = False
    try:
        a = Value(2.0, label='a')
        b = Value(-3.0, label='b')

        assert (a + b).data == -1.0,             "a + b should be -1.0"
        assert (a * b).data == -6.0,             "a * b should be -6.0"
        assert (a - b).data == 5.0,              "a - b should be 5.0"
        assert (b / a).data == -1.5,             "b / a should be -1.5"
        assert (a ** 3).data == 8.0,             "a ** 3 should be 8.0"
        assert abs(a.tanh().data - 0.9640275800758169) < 1e-10, "tanh(2.0) incorrect"
        assert abs(a.exp().data - 7.38905609893065) < 1e-10,    "exp(2.0) incorrect"

        # Reverse operations (e.g. `3.0 + a` should work too)
        assert (a + 2.0).data == 4.0,  "a + 2.0 should be 4.0"
        assert (a * 3.0).data == 6.0,  "a * 3.0 should be 6.0"
        assert (3.0 + b).data == 0.0,  "3.0 + b should be 0.0"
        assert (2.0 * b).data == -6.0, "2.0 * b should be -6.0"
        assert (2.0 - b).data == 5.0,  "2.0 - b should be 5.0"
        assert (3.0 / b).data == -1.0, "3.0 / b should be -1.0"

        # Verify _prev records the graph
        c = a + b
        assert len(c._prev) == 2, "_prev should contain both operands"

        _result = mo.callout(mo.md("✅ Value forward operations are correct!"), kind="success")
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
        _payload = _json.dumps({"notebookId": "backprop_mlp/value_class", "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps({"type": "mlp:notebook-solved", "notebookId": "backprop_mlp/value_class"})))
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
