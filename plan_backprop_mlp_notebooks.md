# Implementation Plan: `backprop_mlp` Notebook Section

This plan is written for Claude Haiku. Follow every step exactly in order.
All paths are relative to `/Users/Aleksandr.Avdiushenko/PycharmProjects/ml-practice-tasks/`.

---

## Overview

Add a new section **`backprop_mlp`** with 6 marimo notebooks, ported from
`/Users/Aleksandr.Avdiushenko/PycharmProjects/youth-ai-club/BackpropagationAndMLP/`.

Source tasks mapped to notebooks:
| Notebook slug          | Source task(s)          | Difficulty |
|------------------------|-------------------------|------------|
| `value_class`          | ClassValue              | easy       |
| `autograd`             | AutoBackpropagation     | medium     |
| `build_mlp`            | BuildingMLP             | medium     |
| `softmax_bp`           | Example + CrossEntropy  | medium     |
| `batchnorm_bp`         | BatchNorm               | hard       |
| `batchnorm_fused`      | ShortBatchNorm          | hard       |

**Critical constraint**: Pyodide (in-browser Python) does NOT have `torch`.
All notebooks must use **numpy only** (no `import torch` anywhere).

---

## Invariants (do not break)

- Every notebook follows the marimo structure from `notebooks/gradient_descent/intro.py`.
- Every checker cell ends with `mo.output.replace(_result)` (not `return _result`).
- The capture block (see template below) is identical in every notebook — only
  `notebookId` and the function tuple change.
- Cell function names use `_` prefix to avoid name collisions: `def _(mo):`, etc.
- Markdown cells use `@app.cell(hide_code=True)`.
- The student's code is always between `# --- student: begin ---` and `# --- student: end ---`.

---

## Step 1 — Update `notebooks/manifest.json`

Open `notebooks/manifest.json`. After the last entry in the `"sections"` array
(currently `simple_neural_network`), add a comma after its closing `}`, then add:

```json
    {
      "slug": "backprop_mlp",
      "title": "Backpropagation & MLP",
      "description": "Build a scalar autograd engine from scratch, then implement backpropagation through cross-entropy, batch normalization, and a multi-layer perceptron — all using pure Python and NumPy.",
      "order": 3,
      "notebooks": [
        { "slug": "value_class",      "title": "Scalar Value Class",           "difficulty": "easy"   },
        { "slug": "autograd",         "title": "Autograd: Backward Pass",      "difficulty": "medium" },
        { "slug": "build_mlp",        "title": "Building an MLP",              "difficulty": "medium" },
        { "slug": "softmax_bp",       "title": "Softmax & Cross-Entropy Backprop", "difficulty": "medium" },
        { "slug": "batchnorm_bp",     "title": "Batch Norm Backpropagation",   "difficulty": "hard"   },
        { "slug": "batchnorm_fused",  "title": "Fused Batch Norm Gradient",    "difficulty": "hard"   }
      ]
    }
```

---

## Step 2 — Create the directory

```bash
mkdir -p notebooks/backprop_mlp
```

---

## Step 3 — Boilerplate capture block (copy this into every checker cell)

The capture block is the same in every notebook. Only `notebookId` and the tuple
after `for _fn in (...)` change. Copy exactly — including the `try/except` wrapper
and the final `mo.output.replace(_result)`.

```python
    # --- capture & report (runs every time, pass or fail) ---
    try:
        import inspect as _inspect, json as _json, js as _js
        from pyodide.ffi import to_js as _to_js
        _srcs = []
        for _fn in (FUNCTION_OR_CLASS_1, FUNCTION_OR_CLASS_2,):   # <-- change this tuple
            try:
                _srcs.append(_inspect.getsource(_fn))
            except Exception:
                pass
        _payload = _json.dumps({"notebookId": "backprop_mlp/SLUG", "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps({"type": "mlp:notebook-solved", "notebookId": "backprop_mlp/SLUG"})))
            _ch.close()
        _js.fetch("/api/notebook-progress", _to_js(
            {"method": "POST", "headers": {"Content-Type": "application/json"},
             "credentials": "include", "body": _payload},
            dict_converter=_js.Object.fromEntries))
    except Exception:
        pass  # not running in Pyodide WASM
    mo.output.replace(_result)
    return
```

---

## Step 4 — Create `notebooks/backprop_mlp/value_class.py`

**Source task**: `BackpropagationAndMLP/ClassValue/task.py`

The student implements a `Value` class for **forward computation only**
(no `backward()`, no `grad` attribute). The class wraps a scalar and supports
arithmetic and activation functions while building a computational graph.

Create the file exactly as shown:

```python
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
```

---

## Step 5 — Create `notebooks/backprop_mlp/autograd.py`

**Source task**: `BackpropagationAndMLP/AutoBackpropagation/task.py`

The student implements the **complete** `Value` class including the backward
pass: `grad` attribute, `_backward` closures in each op, and `backward()` method.

The checker verifies both forward values **and** gradients using the fixed
computation from the source test:
```
x1*w1 + x2*w2 + c → tanh → o  (with x1=2, x2=0, w1=-3, w2=1, c=6.881...)
o.backward()
expected: x1.grad=-1.5, w1.grad=1.0, x2.grad=0.5, w2.grad=0.0
```

The full file structure follows the same pattern as `value_class.py`.
Student cell `# --- student: begin ---` contains the entire `Value` class
(same interface as `value_class.py` but now with grad, _backward, backward).

Key implementation details for each operation's `_backward`:
- `__add__`:  `self.grad += out.grad;  other.grad += out.grad`
- `__mul__`:  `self.grad += other.data * out.grad;  other.grad += self.data * out.grad`
- `__pow__`:  `self.grad += other * (self.data ** (other - 1)) * out.grad`
- `tanh()`:   `self.grad += (1 - t**2) * out.grad`  (where `t` is the tanh output)
- `exp()`:    `self.grad = out.grad * out.data`

`backward()` method: topological sort then iterate in reverse calling `_backward()`:
```python
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
```

Checker cell assertions (after calling `o.backward()`):
```python
assert abs(x1.grad - (-1.5)) < 1e-10, f"x1.grad should be -1.5, got {x1.grad}"
assert abs(w1.grad - 1.0)   < 1e-10, f"w1.grad should be 1.0, got {w1.grad}"
assert abs(x2.grad - 0.5)   < 1e-10, f"x2.grad should be 0.5, got {x2.grad}"
assert abs(w2.grad - 0.0)   < 1e-10, f"w2.grad should be 0.0, got {w2.grad}"
```

Capture tuple: `for _fn in (Value,):`
notebookId: `"backprop_mlp/autograd"`

---

## Step 6 — Create `notebooks/backprop_mlp/build_mlp.py`

**Source task**: `BackpropagationAndMLP/BuildingMLP/task.py`

The student implements `Neuron`, `Layer`, and `MLP` classes using the `Value`
autograd engine and `numpy`.

**Scaffold cell** (non-student, shown to student for reference): provide the
complete working `Value` class from `autograd.py` solution. This cell comes
BEFORE the student cell and is NOT hidden. Do not put it in `# --- student ---`
markers — it is given code, not student code.

The scaffold cell imports `math, random, numpy as np` and defines `Value` in full
(copy the reference implementation from `AutoBackpropagation/task.py`).

**Student cell** contains `Neuron`, `Layer`, `MLP` stubs.

Required behavior:
- `Neuron(nin)`: weights `w = [Value(random.uniform(-1,1)) for _ in range(nin)]`,
  bias `b = Value(random.uniform(-1,1))`. `__call__(x)` computes `(w·x + b).tanh()`.
  `parameters()` returns list: `list(self.w) + [self.b]`.

- `Layer(nin, nout)`: list of `nout` neurons. `__call__(x)` returns a list of
  outputs (or a single Value if nout==1). `parameters()` flattens all neuron params.

- `MLP(nin, nouts)`: builds alternating `Layer` + `Layer` without BatchNorm
  (simplification: omit BatchNorm to avoid complexity). `__call__(x)` threads
  through all layers. `parameters()` flattens all layer params.

  **Note on MLP structure (simplification from source)**: The source
  `BuildingMLP/task.py` alternates Layer + BatchNorm. For this notebook,
  **omit BatchNorm** in MLP to keep it self-contained (batchnorm is in a later
  notebook). MLP should just chain `Layer` objects: one per entry in `nouts`.

Checker assertions:
```python
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
```

Capture tuple: `for _fn in (Neuron, Layer, MLP,):`
notebookId: `"backprop_mlp/build_mlp"`

---

## Step 7 — Create `notebooks/backprop_mlp/softmax_bp.py`

**Source tasks**: `BackpropagationAndMLP/Example/task.py` + `BackpropagationAndMLP/CrossEntropy/task.py`

The student implements 8 functions that together form the backward pass through
a numerically-stable softmax + cross-entropy loss, decomposed step-by-step.

All inputs and outputs are `np.ndarray`. Use only numpy.

**Forward pass** (given as comments in the notebook for context):
```
logit_maxes = logits.max(axis=1, keepdims=True)
norm_logits = logits - logit_maxes        # numerical stability
counts      = np.exp(norm_logits)
counts_sum  = counts.sum(axis=1, keepdims=True)
counts_sum_inv = counts_sum ** -1
probs       = counts * counts_sum_inv
logprobs    = np.log(probs)
loss        = -logprobs[np.arange(n), Yb].mean()
```

**Functions the student implements** (backward pass, in reverse order):

```python
def logprobs_bp(n: int, Yb: np.ndarray, logprobs: np.ndarray) -> np.ndarray:
    """d(loss)/d(logprobs): -1/n at true-class indices, 0 elsewhere."""
    raise NotImplementedError

def probs_bp(probs: np.ndarray, dlogprobs: np.ndarray) -> np.ndarray:
    """d(logprobs)/d(probs) = 1/probs, so dprobs = dlogprobs / probs."""
    raise NotImplementedError

def counts_sum_inv_bp(counts: np.ndarray, dprobs: np.ndarray) -> np.ndarray:
    """probs = counts * counts_sum_inv  →  shape [n, 1]."""
    raise NotImplementedError

def counts_sum_bp(counts_sum: np.ndarray, dcounts_sum_inv: np.ndarray) -> np.ndarray:
    """counts_sum_inv = counts_sum**(-1)  →  d/d(counts_sum)."""
    raise NotImplementedError

def counts_bp(counts: np.ndarray, dcounts_sum: np.ndarray,
              counts_sum_inv: np.ndarray, dprobs: np.ndarray) -> np.ndarray:
    """counts contributes via both probs and counts_sum."""
    raise NotImplementedError

def norm_logits_bp(counts: np.ndarray, dcounts: np.ndarray) -> np.ndarray:
    """counts = exp(norm_logits)  →  d/d(norm_logits) = counts * dcounts."""
    raise NotImplementedError

def logit_maxes_bp(dnorm_logits: np.ndarray) -> np.ndarray:
    """norm_logits = logits - logit_maxes  →  shape [n, 1]."""
    raise NotImplementedError

def logits_bp(logits: np.ndarray, dnorm_logits: np.ndarray,
              dlogit_maxes: np.ndarray) -> np.ndarray:
    """logit_maxes = logits.max(1); norm_logits = logits - logit_maxes."""
    raise NotImplementedError
```

**Oracle** (reference answers for checker, do not expose to student):
```python
def _oracle_logprobs_bp(n, Yb, logprobs):
    d = np.zeros_like(logprobs)
    d[np.arange(n), Yb] = -1.0 / n
    return d

def _oracle_probs_bp(probs, dlogprobs):
    return dlogprobs / probs

def _oracle_counts_sum_inv_bp(counts, dprobs):
    return (dprobs * counts).sum(axis=1, keepdims=True)

def _oracle_counts_sum_bp(counts_sum, dcounts_sum_inv):
    return (-counts_sum ** -2) * dcounts_sum_inv

def _oracle_counts_bp(counts, dcounts_sum, counts_sum_inv, dprobs):
    return counts_sum_inv * dprobs + dcounts_sum * np.ones_like(counts)

def _oracle_norm_logits_bp(counts, dcounts):
    return counts * dcounts

def _oracle_logit_maxes_bp(dnorm_logits):
    return -dnorm_logits.sum(axis=1, keepdims=True)

def _oracle_logits_bp(logits, dnorm_logits, dlogit_maxes):
    return dnorm_logits + (logits == logits.max(axis=1, keepdims=True)) * dlogit_maxes
```

**Checker cell** — run all 8 student functions and compare to oracles:

```python
@app.cell
def _(logit_maxes_bp, logprobs_bp, counts_bp, counts_sum_bp,
      counts_sum_inv_bp, mo, norm_logits_bp, logits_bp, probs_bp, np):
    rng = np.random.default_rng(7)
    _n, _C = 16, 10
    _logits = rng.standard_normal((_n, _C))
    _Yb = rng.integers(0, _C, size=_n)

    # Forward pass
    _lm  = _logits.max(axis=1, keepdims=True)
    _nl  = _logits - _lm
    _cnt = np.exp(_nl)
    _cs  = _cnt.sum(axis=1, keepdims=True)
    _csi = _cs ** -1
    _pr  = _cnt * _csi
    _lp  = np.log(_pr)

    _solved = False
    try:
        _dlp  = logprobs_bp(_n, _Yb, _lp)
        _dpr  = probs_bp(_pr, _dlp)
        _dcsi = counts_sum_inv_bp(_cnt, _dpr)
        _dcs  = counts_sum_bp(_cs, _dcsi)
        _dc   = counts_bp(_cnt, _dcs, _csi, _dpr)
        _dnl  = norm_logits_bp(_cnt, _dc)
        _dlm  = logit_maxes_bp(_dnl)
        _dlo  = logits_bp(_logits, _dnl, _dlm)

        # Oracle: analytical cross-entropy gradient = softmax - one_hot, /n
        _sm = np.exp(_logits - _logits.max(1, keepdims=True))
        _sm /= _sm.sum(1, keepdims=True)
        _expected = _sm.copy()
        _expected[np.arange(_n), _Yb] -= 1
        _expected /= _n

        assert np.allclose(_dlo, _expected, atol=1e-6), \
            f"Final dlogits mismatch: max diff = {np.abs(_dlo - _expected).max():.2e}"

        _result = mo.callout(mo.md(
            "✅ All 8 backward functions correct! "
            f"Max error vs analytical gradient: {np.abs(_dlo - _expected).max():.2e}"
        ), kind="success")
        _solved = True
    except NotImplementedError as e:
        _result = mo.callout(mo.md(f"✏️ {e}"), kind="neutral")
    except Exception as e:
        _result = mo.callout(mo.md(f"❌ {e}"), kind="danger")
    # --- capture & report ---
    try:
        import inspect as _inspect, json as _json, js as _js
        from pyodide.ffi import to_js as _to_js
        _srcs = []
        for _fn in (logprobs_bp, probs_bp, counts_sum_inv_bp, counts_sum_bp,
                    counts_bp, norm_logits_bp, logit_maxes_bp, logits_bp,):
            try:
                _srcs.append(_inspect.getsource(_fn))
            except Exception:
                pass
        _payload = _json.dumps({"notebookId": "backprop_mlp/softmax_bp",
                                "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps(
                {"type": "mlp:notebook-solved", "notebookId": "backprop_mlp/softmax_bp"})))
            _ch.close()
        _js.fetch("/api/notebook-progress", _to_js(
            {"method": "POST", "headers": {"Content-Type": "application/json"},
             "credentials": "include", "body": _payload},
            dict_converter=_js.Object.fromEntries))
    except Exception:
        pass
    mo.output.replace(_result)
    return
```

---

## Step 8 — Create `notebooks/backprop_mlp/batchnorm_bp.py`

**Source task**: `BackpropagationAndMLP/BatchNorm/task.py`

Student implements 12 functions for the backward pass through a batch normalization
layer, each corresponding to one node in the forward computational graph.

**Forward graph** (shapes for reference: batch=32, hidden=64):
```
logits    [32, 27] = h @ W2 + b2
h         [32, 64] = tanh(hpreact)
hpreact   [32, 64] = bngain * bnraw + bnbias
bnraw     [32, 64] = bndiff * bnvar_inv
bnvar_inv [1, 64]  = (bnvar + eps)**(-0.5)
bnvar     [1, 64]  = bndiff2.mean(0, keepdims=True)
bndiff2   [32, 64] = bndiff**2
bndiff    [32, 64] = hprebn - bnmeani
bnmeani   [1, 64]  = hprebn.mean(0, keepdims=True)
```

**All 12 functions** with their docstrings and reference implementations:

```python
def h_bp(dlogits: np.ndarray, W2: np.ndarray) -> np.ndarray:
    """logits = h @ W2 + b2  →  dh = dlogits @ W2.T"""
    # oracle: dlogits @ W2.T
    raise NotImplementedError

def W2_bp(h: np.ndarray, dlogits: np.ndarray) -> np.ndarray:
    """logits = h @ W2 + b2  →  dW2 = h.T @ dlogits"""
    # oracle: h.T @ dlogits
    raise NotImplementedError

def b2_bp(dlogits: np.ndarray) -> np.ndarray:
    """logits = h @ W2 + b2  →  db2 = dlogits.sum(0)"""
    # oracle: dlogits.sum(0)
    raise NotImplementedError

def hpreact_bp(h: np.ndarray, dh: np.ndarray) -> np.ndarray:
    """h = tanh(hpreact)  →  dhpreact = (1 - h**2) * dh"""
    # oracle: (1 - h**2) * dh
    raise NotImplementedError

def bngain_bp(bnraw: np.ndarray, dhpreact: np.ndarray) -> np.ndarray:
    """hpreact = bngain * bnraw + bnbias  →  dbngain, shape [1, dim]"""
    # oracle: (bnraw * dhpreact).sum(0, keepdims=True)
    raise NotImplementedError

def bnbias_bp(dhpreact: np.ndarray) -> np.ndarray:
    """hpreact = bngain * bnraw + bnbias  →  dbnbias, shape [1, dim]"""
    # oracle: dhpreact.sum(0, keepdims=True)
    raise NotImplementedError

def bnraw_bp(dhpreact: np.ndarray, bngain: np.ndarray) -> np.ndarray:
    """hpreact = bngain * bnraw + bnbias  →  dbnraw"""
    # oracle: bngain * dhpreact
    raise NotImplementedError

def bnvar_inv_bp(bndiff: np.ndarray, dbnraw: np.ndarray) -> np.ndarray:
    """bnraw = bndiff * bnvar_inv  →  dbnvar_inv, shape [1, dim]"""
    # oracle: (bndiff * dbnraw).sum(0, keepdims=True)
    raise NotImplementedError

def bnvar_bp(bnvar: np.ndarray, dbnvar_inv: np.ndarray, eps: float = 1e-5) -> np.ndarray:
    """bnvar_inv = (bnvar + eps)**(-0.5)  →  dbnvar"""
    # oracle: -0.5 * (bnvar + eps)**(-1.5) * dbnvar_inv
    raise NotImplementedError

def bndiff2_bp(bndiff2: np.ndarray, n: int, dbnvar: np.ndarray) -> np.ndarray:
    """bnvar = bndiff2.mean(0)  →  dbndiff2"""
    # oracle: dbnvar / n * np.ones_like(bndiff2)
    raise NotImplementedError

def bndiff_bp(bndiff: np.ndarray, dbndiff2: np.ndarray,
              bnvar_inv: np.ndarray, dbnraw: np.ndarray) -> np.ndarray:
    """bndiff contributes via bndiff2 (=bndiff**2) and bnraw (=bndiff*bnvar_inv)"""
    # oracle: 2 * bndiff * dbndiff2 + bnvar_inv * dbnraw
    raise NotImplementedError

def bnmeani_bp(dbndiff: np.ndarray) -> np.ndarray:
    """bndiff = hprebn - bnmeani  →  dbnmeani, shape [1, dim]"""
    # oracle: -dbndiff.sum(0, keepdims=True)
    raise NotImplementedError
```

**Checker cell** — verify each function against its oracle:

Create `rng = np.random.default_rng(3)`, shapes `n=32, hidden=64, out=27`.
Generate random tensors: `hprebn [32,64]`, `bngain [1,64]`, `bnbias [1,64]`,
`W2 [64,27]`, `b2 [27]`, `dlogits [32,27]` (simulates upstream gradient).

Then compute the full forward pass (all intermediate values) and
verify each function against the oracle:

```python
# Example verification pattern (repeat for all 12):
_dh = h_bp(dlogits, W2)
_dh_expected = dlogits @ W2.T
assert _dh.shape == _dh_expected.shape, f"h_bp shape mismatch"
assert np.allclose(_dh, _dh_expected, atol=1e-5), \
    f"h_bp: max diff {np.abs(_dh - _dh_expected).max():.2e}"
```

All 12 assertions must pass before `_solved = True`.
Success message: `"✅ All 12 batch norm backward functions correct!"`

Capture tuple (all 12 functions):
```python
for _fn in (h_bp, W2_bp, b2_bp, hpreact_bp, bngain_bp, bnbias_bp,
            bnraw_bp, bnvar_inv_bp, bnvar_bp, bndiff2_bp, bndiff_bp, bnmeani_bp,):
```
notebookId: `"backprop_mlp/batchnorm_bp"`

---

## Step 9 — Create `notebooks/backprop_mlp/batchnorm_fused.py`

**Source task**: `BackpropagationAndMLP/ShortBatchNorm/task.py`

Student implements a **single fused** backward function that is mathematically
equivalent to composing all 12 functions from `batchnorm_bp`:

```python
def hprebn_bp(n: int, bngain: np.ndarray, bnvar_inv: np.ndarray,
              bnraw: np.ndarray, dhpreact: np.ndarray) -> np.ndarray:
    """Fused batch-norm backward — equivalent to the 12-step decomposition.

    dhprebn = bngain * bnvar_inv / n * (
        n * dhpreact
        - dhpreact.sum(0)
        - n / (n - 1) * bnraw * (dhpreact * bnraw).sum(0)
    )
    """
    raise NotImplementedError("Implement hprebn_bp")
```

**Checker**: compare student's `hprebn_bp` against the oracle above AND against
a numerical gradient (finite differences) to confirm correctness:

```python
rng = np.random.default_rng(5)
n, hidden = 16, 8
hprebn  = rng.standard_normal((n, hidden))
bngain  = rng.standard_normal((1, hidden)) + 1.0
bnbias  = rng.standard_normal((1, hidden))
dhpreact = rng.standard_normal((n, hidden))
eps = 1e-5

bnmeani  = hprebn.mean(0, keepdims=True)
bndiff   = hprebn - bnmeani
bndiff2  = bndiff ** 2
bnvar    = bndiff2.mean(0, keepdims=True)
bnvar_inv = (bnvar + eps) ** -0.5
bnraw    = bndiff * bnvar_inv

result   = hprebn_bp(n, bngain, bnvar_inv, bnraw, dhpreact)
expected = bngain * bnvar_inv / n * (
    n * dhpreact - dhpreact.sum(0) - n / (n - 1) * bnraw * (dhpreact * bnraw).sum(0)
)
assert np.allclose(result, expected, atol=1e-9), \
    f"max diff: {np.abs(result - expected).max():.2e}"
```

Capture tuple: `for _fn in (hprebn_bp,):`
notebookId: `"backprop_mlp/batchnorm_fused"`

---

## Step 10 — Regenerate HTML exports

After creating all 6 notebook files, run:

```bash
cd /Users/Aleksandr.Avdiushenko/PycharmProjects/ml-practice-tasks
python export_notebooks.py
```

This generates `web/public/notebooks/backprop_mlp/*/index.html` for each notebook.

Then verify:
```bash
python export_notebooks.py --check
```

Should print "Notebook exports are up to date (N notebooks)." and exit 0.

---

## Step 11 — Run tests

```bash
# There are no pytest tests for notebooks (tests are inside the notebooks themselves)
# Just verify the export completed cleanly (Step 10).
```

---

## Step 12 — Final checks

1. `notebooks/manifest.json` — has 3 sections total, `backprop_mlp` has 6 entries.
2. `notebooks/backprop_mlp/` — contains exactly: `value_class.py`, `autograd.py`,
   `build_mlp.py`, `softmax_bp.py`, `batchnorm_bp.py`, `batchnorm_fused.py`.
3. `web/public/notebooks/backprop_mlp/` — contains 6 subdirs, each with `index.html`.
4. Each `index.html` contains the string `student: begin` (marker was preserved).
5. Each `index.html` contains `backprop_mlp/` (notebookId is correct).
6. No notebook imports `torch`.

---

## Common mistakes to avoid

- **Do not import torch** — use numpy everywhere.
- **Do not forget `return` at the end of every marimo cell function** that needs to
  export names. The student cell must `return (Value,)` or `return (fn1, fn2, ...)`.
- **Do not forget `(hide_code=True)`** on all markdown cells.
- **Capture block must be inside the checker cell function**, before the final `return`.
- **`mo.output.replace(_result)` must be the last statement** before `return` in the
  checker cell — do not return `_result` directly.
- In the checker cell function signature, list ALL names the cell uses:
  `def _(fn1, fn2, mo, np):` — marimo infers dependencies from the signature.
- **`__generated_with`** version: use `"0.23.9"` (same as existing notebooks).

---

## Reference file to copy structure from

Read `notebooks/gradient_descent/intro.py` before writing any notebook.
It is the canonical template. Every cell, every decorator, every `return`
statement in the new notebooks should follow that exact pattern.
