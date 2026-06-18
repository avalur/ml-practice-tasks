# Implementation Plan: `transformers` Notebook Section

This plan is written for Claude Haiku. Follow every step exactly in order.
All paths are relative to `/Users/Aleksandr.Avdiushenko/PycharmProjects/ml-practice-tasks/`.

---

## Source tasks mapped to notebooks

| Notebook slug       | Source task(s)           | Difficulty |
|---------------------|--------------------------|------------|
| `tokenization`      | TokenizationSymbolLevel  | easy       |
| `attention_head`    | Head                     | medium     |
| `multi_head`        | MultiHead                | medium     |
| `transformer_block` | TransformerBlock         | hard       |

**SKIPPED** (not portable):
- `TokenizationTiktoken` — uses `tiktoken`, not available in Pyodide.
- `Attention`, `Tokenization and embeddings`, `YourGPT` — no task.py.

**Critical constraint**: Pyodide does NOT have `torch`, `torch.nn`, or `tiktoken`.
All notebooks use **numpy only** (`import numpy as np`). No `import torch` anywhere.

**Design change**: Instead of `nn.Module` classes, every transformer component is a
**pure function** that accepts weight matrices as `np.ndarray` arguments.
This makes the math explicit and is more educational.

---

## Invariants (same as backprop_mlp plan — do not break)

- Every notebook follows `notebooks/gradient_descent/intro.py` structure exactly.
- Markdown cells: `@app.cell(hide_code=True)`.
- Student code between `# --- student: begin ---` and `# --- student: end ---`.
- Checker cell ends with `mo.output.replace(_result)` before `return`.
- Capture block is identical in every notebook (only `notebookId` and function tuple change).

---

## Step 1 — Update `notebooks/manifest.json`

Add after the `backprop_mlp` section (which already exists). Add a comma after
the `backprop_mlp` closing `}`, then insert:

```json
    {
      "slug": "transformers",
      "title": "Transformers",
      "description": "Build a transformer from scratch using NumPy: tokenize text, implement scaled dot-product attention, multi-head attention, and a full transformer block with residual connections and layer normalization.",
      "order": 4,
      "notebooks": [
        { "slug": "tokenization",      "title": "Tokenization & Embeddings",     "difficulty": "easy"   },
        { "slug": "attention_head",    "title": "Attention Head",                "difficulty": "medium" },
        { "slug": "multi_head",        "title": "Multi-Head Attention",          "difficulty": "medium" },
        { "slug": "transformer_block", "title": "Transformer Block",             "difficulty": "hard"   }
      ]
    }
```

---

## Step 2 — Create directory

```bash
mkdir -p notebooks/transformers
```

---

## Step 3 — Capture block template (copy into every checker cell)

Same as in the backprop_mlp plan. Only `notebookId` and the `for _fn in (...)` tuple change.

```python
    # --- capture & report (runs every time, pass or fail) ---
    try:
        import inspect as _inspect, json as _json, js as _js
        from pyodide.ffi import to_js as _to_js
        _srcs = []
        for _fn in (FUNCTION_1, FUNCTION_2,):   # <-- change this tuple per notebook
            try:
                _srcs.append(_inspect.getsource(_fn))
            except Exception:
                pass
        _payload = _json.dumps({"notebookId": "transformers/SLUG",
                                "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps(
                {"type": "mlp:notebook-solved", "notebookId": "transformers/SLUG"})))
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

## Step 4 — Create `notebooks/transformers/tokenization.py`

**Source**: `BackpropagationAndMLP/TokenizationSymbolLevel/task.py`

The student implements character-level tokenization and a random embedding table.
Pure Python + numpy, no special libraries.

---

### Imports cell

```python
@app.cell
def _():
    import marimo as mo
    import numpy as np
    return mo, np
```

---

### Markdown cell (hide_code=True)

```
# Tokenization & Embeddings

To train a language model we first need to convert text into numbers.
**Character-level tokenization** assigns a unique integer to every distinct
character in the vocabulary.

Convention used throughout these notebooks:
- Index `0` is reserved for `'#'` (padding / unknown token).
- Every other character gets an index `1, 2, 3, …` in alphabetical order.

Once we have integer token IDs we look them up in an **embedding table**
`C` of shape `[vocab_size, n_embd]` — each row is the learnable vector
representation of one token.

## Tasks

1. `build_vocab(words)` — given a list of words, build `stoi` (char→int)
   and `itos` (int→char) mappings. `'#'` must map to `0`; remaining
   characters get consecutive integers starting from `1`, assigned in
   **sorted order**.
2. `get_embedding_table(vocab_size, n_embd, seed)` — return a randomly
   initialized `[vocab_size, n_embd]` numpy array using
   `np.random.default_rng(seed).standard_normal(...)`.
```

---

### Student cell

```python
@app.cell
def _(np):
    # --- student: begin ---

    def build_vocab(words: list) -> tuple:
        """Build char-level vocabulary from a list of words.

        Args:
            words: list of strings

        Returns:
            stoi: dict mapping char -> int  ('#' maps to 0, others to 1, 2, ...)
            itos: dict mapping int -> char  (inverse of stoi)
        """
        raise NotImplementedError("Implement build_vocab")

    def get_embedding_table(vocab_size: int, n_embd: int, seed: int) -> np.ndarray:
        """Create a randomly initialized embedding table.

        Args:
            vocab_size: number of tokens (rows)
            n_embd:     embedding dimension (columns)
            seed:       RNG seed for reproducibility

        Returns:
            np.ndarray of shape [vocab_size, n_embd]
        """
        raise NotImplementedError("Implement get_embedding_table")

    # --- student: end ---
    return build_vocab, get_embedding_table
```

---

### Checker cell

```python
@app.cell
def _(build_vocab, get_embedding_table, mo, np):
    _solved = False
    try:
        # --- build_vocab checks ---
        _words = ["hello", "world", "hi"]
        _stoi, _itos = build_vocab(_words)

        assert isinstance(_stoi, dict), "stoi must be a dict"
        assert isinstance(_itos, dict), "itos must be a dict"
        assert _stoi.get('#') == 0, "'#' must map to index 0"

        _chars = sorted(set(''.join(_words)))
        for _c in _chars:
            assert _c in _stoi, f"char '{_c}' missing from stoi"
        for _c in _chars:
            assert _itos[_stoi[_c]] == _c, f"itos[stoi['{_c}']] != '{_c}'"

        # Indices must start from 1 and be consecutive
        _indices = sorted(_stoi[c] for c in _chars)
        assert _indices == list(range(1, len(_chars) + 1)), \
            f"Non-'#' chars must get indices 1..n in sorted order, got {_indices}"

        # --- get_embedding_table checks ---
        _emb = get_embedding_table(10, 4, seed=42)
        assert _emb.shape == (10, 4), f"shape should be (10, 4), got {_emb.shape}"
        assert isinstance(_emb, np.ndarray), "must return np.ndarray"

        # Same seed → same result
        _emb2 = get_embedding_table(10, 4, seed=42)
        assert np.allclose(_emb, _emb2), "same seed must give same result"

        # Different seed → different result
        _emb3 = get_embedding_table(10, 4, seed=99)
        assert not np.allclose(_emb, _emb3), "different seeds must give different results"

        # Oracle: must match np.random.default_rng(seed).standard_normal(shape)
        _expected = np.random.default_rng(7).standard_normal((5, 3))
        _got = get_embedding_table(5, 3, seed=7)
        assert np.allclose(_got, _expected), \
            "get_embedding_table must use np.random.default_rng(seed).standard_normal(shape)"

        _result = mo.callout(mo.md(
            "✅ `build_vocab` and `get_embedding_table` are correct!"
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
        for _fn in (build_vocab, get_embedding_table,):
            try:
                _srcs.append(_inspect.getsource(_fn))
            except Exception:
                pass
        _payload = _json.dumps({"notebookId": "transformers/tokenization",
                                "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps(
                {"type": "mlp:notebook-solved", "notebookId": "transformers/tokenization"})))
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

## Step 5 — Create `notebooks/transformers/attention_head.py`

**Source**: `Transformers/Head/task.py`

The student implements scaled dot-product attention as a pure numpy function.
No `nn.Module` — weight matrices are passed as arguments.

---

### Imports cell

```python
@app.cell
def _():
    import marimo as mo
    import numpy as np
    return mo, np
```

---

### Markdown cell (hide_code=True)

```
# Attention Head

The core of every transformer is **scaled dot-product attention**:

$$\text{Attention}(Q, K, V) = \text{softmax}\!\left(\frac{QK^\top}{\sqrt{d_k}}\right) V$$

Given an input sequence $x$ of shape $[T, d_{\text{model}}]$:

1. Project to queries, keys, values:
   $Q = xW_Q,\;\; K = xW_K,\;\; V = xW_V$
   Each projection matrix $W_* \in \mathbb{R}^{d_{\text{model}} \times d_k}$.

2. Compute raw attention scores: $S = QK^\top / \sqrt{d_k}$   (shape $[T, T]$)

3. Apply **causal mask**: set $S_{ij} = -\infty$ for all $j > i$
   (a token may only attend to itself and earlier tokens).

4. Softmax across the last axis to get weights $A$.

5. Return $AV$   (shape $[T, d_k]$).

In this notebook $x$ has shape $[B, T, d_{\text{model}}]$ (batched),
so all matrix operations broadcast over the batch dimension $B$.

## Task

Implement `attention_head(x, Wq, Wk, Wv)` following the 5 steps above.
```

---

### Student cell

```python
@app.cell
def _(np):
    # --- student: begin ---

    def attention_head(
        x:  np.ndarray,   # [B, T, n_embd]
        Wq: np.ndarray,   # [n_embd, head_size]
        Wk: np.ndarray,   # [n_embd, head_size]
        Wv: np.ndarray,   # [n_embd, head_size]
    ) -> np.ndarray:      # [B, T, head_size]
        """Single self-attention head with causal (lower-triangular) masking.

        Steps:
          1. Q = x @ Wq,  K = x @ Wk,  V = x @ Wv
          2. scores = Q @ K.transpose(-2, -1) / sqrt(head_size)
          3. Mask: scores[..., i, j] = -inf  for j > i  (future tokens)
          4. weights = softmax(scores, axis=-1)
          5. return weights @ V
        """
        raise NotImplementedError("Implement attention_head")

    # --- student: end ---
    return (attention_head,)
```

---

### Checker cell

The oracle implements the same 5 steps in numpy.
Use a small fixed example: B=2, T=5, n_embd=8, head_size=4.

```python
@app.cell
def _(attention_head, mo, np):
    # Oracle
    def _oracle(x, Wq, Wk, Wv):
        B, T, _ = x.shape
        head_size = Wq.shape[1]
        Q = x @ Wq              # [B, T, head_size]
        K = x @ Wk
        V = x @ Wv
        scores = Q @ K.swapaxes(-2, -1) / np.sqrt(head_size)   # [B, T, T]
        # Causal mask: positions j > i get -inf
        mask = np.triu(np.ones((T, T), dtype=bool), k=1)
        scores[:, mask] = -np.inf
        # Numerically stable softmax
        scores -= scores.max(axis=-1, keepdims=True)
        w = np.exp(scores)
        w /= w.sum(axis=-1, keepdims=True)
        return w @ V            # [B, T, head_size]

    _solved = False
    try:
        rng = np.random.default_rng(0)
        B, T, n_embd, head_size = 2, 5, 8, 4
        x   = rng.standard_normal((B, T, n_embd))
        Wq  = rng.standard_normal((n_embd, head_size)) * 0.1
        Wk  = rng.standard_normal((n_embd, head_size)) * 0.1
        Wv  = rng.standard_normal((n_embd, head_size)) * 0.1

        out  = attention_head(x, Wq, Wk, Wv)
        exp  = _oracle(x, Wq, Wk, Wv)

        assert out.shape == (B, T, head_size), \
            f"shape: expected {(B, T, head_size)}, got {out.shape}"
        assert np.allclose(out, exp, atol=1e-6), \
            f"values differ: max diff = {np.abs(out - exp).max():.2e}"

        # Verify causal property: row 0 must not depend on tokens 1..T-1
        # Change token 1 and verify token 0's output is unchanged
        x2 = x.copy(); x2[:, 1:, :] += 999.0
        out2 = attention_head(x2, Wq, Wk, Wv)
        assert np.allclose(out[:, 0, :], out2[:, 0, :], atol=1e-4), \
            "Causal masking broken: position 0 should not see future tokens"

        _result = mo.callout(mo.md(
            f"✅ `attention_head` correct!  shape {out.shape},  "
            f"max error vs oracle: {np.abs(out - exp).max():.2e}"
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
        for _fn in (attention_head,):
            try:
                _srcs.append(_inspect.getsource(_fn))
            except Exception:
                pass
        _payload = _json.dumps({"notebookId": "transformers/attention_head",
                                "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps(
                {"type": "mlp:notebook-solved", "notebookId": "transformers/attention_head"})))
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

## Step 6 — Create `notebooks/transformers/multi_head.py`

**Source**: `Transformers/MultiHead/task.py`

**Scaffold cell** (before the student cell, NOT hidden, NOT between markers):
Provide the working `attention_head` implementation from the previous notebook.
The student may read it for reference. The scaffold cell just defines the function;
the student does NOT modify it.

Include the full working `attention_head` oracle code (same as the oracle from
Step 5's checker) as a scaffold.

---

### What the student implements

```python
def multi_head_attention(
    x:      np.ndarray,         # [B, T, n_embd]
    heads:  list,               # list of (Wq, Wk, Wv) tuples, each [n_embd, head_size]
    W_out:  np.ndarray,         # [n_embd, n_embd]   (n_embd = num_heads * head_size)
) -> np.ndarray:                # [B, T, n_embd]
    """Run num_heads attention heads in parallel, concatenate, project.

    Steps:
      1. For each (Wq, Wk, Wv) in heads: compute attention_head(x, Wq, Wk, Wv)
         → each output has shape [B, T, head_size]
      2. Concatenate along last axis → [B, T, n_embd]  (n_embd = num_heads * head_size)
      3. Project through W_out: result @ W_out  → [B, T, n_embd]
    """
    raise NotImplementedError("Implement multi_head_attention")
```

**Oracle** (for checker):
```python
def _oracle_mha(x, heads, W_out, _attn_fn):
    head_outs = [_attn_fn(x, Wq, Wk, Wv) for Wq, Wk, Wv in heads]
    cat = np.concatenate(head_outs, axis=-1)   # [B, T, n_embd]
    return cat @ W_out                          # [B, T, n_embd]
```

**Checker** — use B=2, T=5, n_embd=8, num_heads=2, head_size=4:

```python
rng = np.random.default_rng(1)
B, T, n_embd, num_heads, head_size = 2, 5, 8, 2, 4
x     = rng.standard_normal((B, T, n_embd))
heads = [(rng.standard_normal((n_embd, head_size)) * 0.1,
          rng.standard_normal((n_embd, head_size)) * 0.1,
          rng.standard_normal((n_embd, head_size)) * 0.1)
         for _ in range(num_heads)]
W_out = rng.standard_normal((n_embd, n_embd)) * 0.1

out = multi_head_attention(x, heads, W_out)
exp = _oracle_mha(x, heads, W_out, _scaffold_attention_head)

assert out.shape == (B, T, n_embd)
assert np.allclose(out, exp, atol=1e-6)
```

Capture tuple: `for _fn in (multi_head_attention,):`
notebookId: `"transformers/multi_head"`

---

## Step 7 — Create `notebooks/transformers/transformer_block.py`

**Source**: `Transformers/TransformerBlock/task.py`

**Scaffold cell** (not hidden, not student): provide working implementations of
both `attention_head` and `multi_head_attention` (copy the working solutions).
Student may read them.

---

### What the student implements — 3 functions

All three are required; all must pass before `_solved = True`.

#### Function 1: `feed_forward`

```python
def feed_forward(
    x:  np.ndarray,   # [B, T, n_embd]
    W1: np.ndarray,   # [n_embd, 4 * n_embd]
    b1: np.ndarray,   # [4 * n_embd]
    W2: np.ndarray,   # [4 * n_embd, n_embd]
    b2: np.ndarray,   # [n_embd]
) -> np.ndarray:      # [B, T, n_embd]
    """Two-layer feed-forward network with ReLU activation.

    FFN(x) = ReLU(x @ W1 + b1) @ W2 + b2
    (Linear → ReLU → Linear, hidden dim = 4 * n_embd)
    """
    raise NotImplementedError("Implement feed_forward")
```

**Oracle**:
```python
def _oracle_ff(x, W1, b1, W2, b2):
    h = np.maximum(0, x @ W1 + b1)   # ReLU
    return h @ W2 + b2
```

#### Function 2: `layer_norm`

```python
def layer_norm(
    x:     np.ndarray,   # [..., n_embd]  (any leading dims)
    gamma: np.ndarray,   # [n_embd]
    beta:  np.ndarray,   # [n_embd]
    eps:   float = 1e-5,
) -> np.ndarray:          # same shape as x
    """Layer normalization applied over the last axis.

    Steps:
      1. mean = x.mean(axis=-1, keepdims=True)
      2. var  = x.var(axis=-1, keepdims=True)
      3. xhat = (x - mean) / sqrt(var + eps)
      4. return gamma * xhat + beta
    """
    raise NotImplementedError("Implement layer_norm")
```

**Oracle**:
```python
def _oracle_ln(x, gamma, beta, eps=1e-5):
    mean = x.mean(axis=-1, keepdims=True)
    var  = x.var(axis=-1, keepdims=True)
    xhat = (x - mean) / np.sqrt(var + eps)
    return gamma * xhat + beta
```

#### Function 3: `transformer_block`

```python
def transformer_block(
    x:          np.ndarray,   # [B, T, n_embd]
    heads:      list,         # list of (Wq, Wk, Wv) tuples
    W_out:      np.ndarray,   # [n_embd, n_embd]
    W1: np.ndarray, b1: np.ndarray,   # FFN first layer
    W2: np.ndarray, b2: np.ndarray,   # FFN second layer
    ln1_gamma:  np.ndarray,   # [n_embd]
    ln1_beta:   np.ndarray,   # [n_embd]
    ln2_gamma:  np.ndarray,   # [n_embd]
    ln2_beta:   np.ndarray,   # [n_embd]
) -> np.ndarray:               # [B, T, n_embd]
    """One transformer block: pre-norm attention + pre-norm FFN, both with residual.

    x = x + multi_head_attention(layer_norm(x, ln1_gamma, ln1_beta), heads, W_out)
    x = x + feed_forward(layer_norm(x, ln2_gamma, ln2_beta), W1, b1, W2, b2)
    return x
    """
    raise NotImplementedError("Implement transformer_block")
```

**Oracle**:
```python
def _oracle_block(x, heads, W_out, W1, b1, W2, b2, ln1g, ln1b, ln2g, ln2b,
                  _mha, _ff, _ln):
    x = x + _mha(_ln(x, ln1g, ln1b), heads, W_out)
    x = x + _ff(_ln(x, ln2g, ln2b), W1, b1, W2, b2)
    return x
```

---

### Checker cell

Verify all three functions independently, then verify the full block.
Use B=2, T=4, n_embd=8, num_heads=2, head_size=4:

```python
@app.cell
def _(feed_forward, layer_norm, transformer_block, mo, np):
    # (scaffold attention fns available from scaffold cell via marimo dependency)

    def _oracle_ff(x, W1, b1, W2, b2):
        return np.maximum(0, x @ W1 + b1) @ W2 + b2

    def _oracle_ln(x, gamma, beta, eps=1e-5):
        mean = x.mean(-1, keepdims=True)
        var  = x.var(-1, keepdims=True)
        return gamma * (x - mean) / np.sqrt(var + eps) + beta

    _solved = False
    try:
        rng = np.random.default_rng(2)
        B, T, n_embd, num_heads, head_size = 2, 4, 8, 2, 4
        hidden = 4 * n_embd

        x = rng.standard_normal((B, T, n_embd))

        # --- layer_norm check ---
        gamma = rng.standard_normal(n_embd)
        beta  = rng.standard_normal(n_embd)
        _ln_out = layer_norm(x, gamma, beta)
        _ln_exp = _oracle_ln(x, gamma, beta)
        assert _ln_out.shape == x.shape, f"layer_norm shape mismatch: {_ln_out.shape}"
        assert np.allclose(_ln_out, _ln_exp, atol=1e-6), \
            f"layer_norm values differ: max err {np.abs(_ln_out - _ln_exp).max():.2e}"

        # --- feed_forward check ---
        W1 = rng.standard_normal((n_embd, hidden)) * 0.1
        b1 = rng.standard_normal(hidden) * 0.1
        W2 = rng.standard_normal((hidden, n_embd)) * 0.1
        b2 = rng.standard_normal(n_embd) * 0.1
        _ff_out = feed_forward(x, W1, b1, W2, b2)
        _ff_exp = _oracle_ff(x, W1, b1, W2, b2)
        assert _ff_out.shape == (B, T, n_embd), f"feed_forward shape: {_ff_out.shape}"
        assert np.allclose(_ff_out, _ff_exp, atol=1e-6), \
            f"feed_forward values differ: max err {np.abs(_ff_out - _ff_exp).max():.2e}"

        # --- transformer_block check ---
        heads = [(rng.standard_normal((n_embd, head_size)) * 0.1,
                  rng.standard_normal((n_embd, head_size)) * 0.1,
                  rng.standard_normal((n_embd, head_size)) * 0.1)
                 for _ in range(num_heads)]
        W_out = rng.standard_normal((n_embd, n_embd)) * 0.1
        ln1g  = rng.standard_normal(n_embd); ln1b = rng.standard_normal(n_embd)
        ln2g  = rng.standard_normal(n_embd); ln2b = rng.standard_normal(n_embd)

        _tb_out = transformer_block(x, heads, W_out, W1, b1, W2, b2,
                                    ln1g, ln1b, ln2g, ln2b)

        # Oracle uses scaffold implementations
        def _oracle_mha(x_, heads_, Wout_):
            outs = [_scaffold_attention_head(x_, Wq, Wk, Wv)
                    for Wq, Wk, Wv in heads_]
            return np.concatenate(outs, axis=-1) @ Wout_

        _tmp = x + _oracle_mha(_oracle_ln(x, ln1g, ln1b), heads, W_out)
        _tb_exp = _tmp + _oracle_ff(_oracle_ln(_tmp, ln2g, ln2b), W1, b1, W2, b2)

        assert _tb_out.shape == (B, T, n_embd), f"transformer_block shape: {_tb_out.shape}"
        assert np.allclose(_tb_out, _tb_exp, atol=1e-5), \
            f"transformer_block values differ: max err {np.abs(_tb_out - _tb_exp).max():.2e}"

        _result = mo.callout(mo.md(
            "✅ `layer_norm`, `feed_forward`, and `transformer_block` all correct!"
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
        for _fn in (feed_forward, layer_norm, transformer_block,):
            try:
                _srcs.append(_inspect.getsource(_fn))
            except Exception:
                pass
        _payload = _json.dumps({"notebookId": "transformers/transformer_block",
                                "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps(
                {"type": "mlp:notebook-solved",
                 "notebookId": "transformers/transformer_block"})))
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

## Step 8 — Scaffold cells: exact code to provide

### `multi_head.py` scaffold (working `attention_head`)

Place this cell BEFORE the student cell. It is a regular `@app.cell` (not hidden,
not student). Name the function `_scaffold_attention_head` to avoid name collision:

```python
@app.cell
def _(np):
    """Working attention_head — provided as scaffold for multi-head notebook."""
    def _scaffold_attention_head(x, Wq, Wk, Wv):
        B, T, _ = x.shape
        head_size = Wq.shape[1]
        Q = x @ Wq; K = x @ Wk; V = x @ Wv
        scores = Q @ K.swapaxes(-2, -1) / np.sqrt(head_size)
        mask = np.triu(np.ones((T, T), dtype=bool), k=1)
        scores[:, mask] = -np.inf
        scores -= scores.max(axis=-1, keepdims=True)
        w = np.exp(scores); w /= w.sum(axis=-1, keepdims=True)
        return w @ V
    return (_scaffold_attention_head,)
```

### `transformer_block.py` scaffold (working `attention_head` + `multi_head_attention`)

```python
@app.cell
def _(np):
    """Working attention implementations — provided as scaffold."""
    def _scaffold_attention_head(x, Wq, Wk, Wv):
        B, T, _ = x.shape
        head_size = Wq.shape[1]
        Q = x @ Wq; K = x @ Wk; V = x @ Wv
        scores = Q @ K.swapaxes(-2, -1) / np.sqrt(head_size)
        mask = np.triu(np.ones((T, T), dtype=bool), k=1)
        scores[:, mask] = -np.inf
        scores -= scores.max(axis=-1, keepdims=True)
        w = np.exp(scores); w /= w.sum(axis=-1, keepdims=True)
        return w @ V

    def _scaffold_multi_head(x, heads, W_out):
        outs = [_scaffold_attention_head(x, Wq, Wk, Wv) for Wq, Wk, Wv in heads]
        return np.concatenate(outs, axis=-1) @ W_out

    return _scaffold_attention_head, _scaffold_multi_head
```

The checker in `transformer_block.py` calls `_scaffold_attention_head` directly
(it is in scope via marimo's dependency system since the scaffold cell returns it).

---

## Step 9 — Regenerate HTML exports

```bash
cd /Users/Aleksandr.Avdiushenko/PycharmProjects/ml-practice-tasks
python export_notebooks.py
python export_notebooks.py --check
```

Should print "Notebook exports are up to date (14 notebooks)." (10 existing + 4 new).

---

## Step 10 — Final verification checklist

1. `notebooks/manifest.json` has 4 sections; `transformers` section has 4 entries.
2. `notebooks/transformers/` contains exactly: `tokenization.py`, `attention_head.py`,
   `multi_head.py`, `transformer_block.py`.
3. `web/public/notebooks/transformers/` contains 4 subdirs, each with `notebook.html`
   (NOT `index.html` — the export script now uses `notebook.html`).
4. Each `notebook.html` contains the string `student: begin`.
5. Each `notebook.html` contains `transformers/` in the notebookId.
6. **No notebook imports torch**. Run: `grep -r "import torch" notebooks/transformers/` → must be empty.

---

## Common mistakes to avoid

- **`x @ W` vs `x @ W.T`**: For Linear(x, W) in PyTorch `nn.Linear`, W has shape
  `[out, in]` and computes `x @ W.T + b`. In our numpy convention, we store W as
  `[in, out]` so it's `x @ W + b`. The plan above uses `[in, out]` consistently
  (W1 is `[n_embd, 4*n_embd]`), so use `x @ W1 + b1` (no transpose).

- **`swapaxes(-2, -1)` vs `.T`**: For batched tensors `[B, T, d]`, use
  `K.swapaxes(-2, -1)` to transpose the last two axes. `.T` reverses ALL axes and
  gives wrong shape for 3D arrays.

- **Softmax numerical stability**: always subtract the row max before exp:
  `scores -= scores.max(axis=-1, keepdims=True)` before `np.exp(scores)`.

- **Causal mask shape**: `np.triu(np.ones((T, T), dtype=bool), k=1)` gives True
  where j > i. Apply as `scores[:, mask] = -np.inf` (works for batched `[B, T, T]`).

- **`layer_norm` axis**: normalize over the LAST axis (`axis=-1`, the feature dim),
  not over the batch or time dimensions.

- **Marimo cell return**: every cell function that defines a name the next cell uses
  must return it in a tuple: `return (attention_head,)` or `return attention_head, Wq`.

- **`__generated_with`**: use `"0.23.9"` (same as existing notebooks).

---

## Reference

Read `notebooks/gradient_descent/full_gd.py` before writing any notebook.
It is the canonical template for notebooks with a single student function.
Read `notebooks/backprop_mlp/batchnorm_bp.py` (once created) for the
multi-function scaffold pattern.
