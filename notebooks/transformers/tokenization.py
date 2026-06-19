import marimo

__generated_with = "0.23.9"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import numpy as np
    return mo, np


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
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
    """)
    return


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


@app.cell(hide_code=True)
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
    # --- capture & report (runs every time, pass or fail) ---
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
        pass  # not running in Pyodide WASM
    mo.output.replace(_result)
    return


if __name__ == "__main__":
    app.run()
