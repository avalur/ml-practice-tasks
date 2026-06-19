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
    # kNN from Scratch

    **ML interview staple — implement ML algorithms from scratch**

    Implement the **k-Nearest Neighbours** classifier using NumPy only
    (no `sklearn`).

    **Algorithm**:
    1. For each test point `x`, compute its Euclidean distance to every
       training point.
    2. Find the `k` nearest training points (smallest distances).
    3. Return the **majority label** among those `k` neighbours.
       Break ties by choosing the smaller label.

    **ML relevance**: kNN is used as a baseline, for anomaly detection, and
    for embedding-space retrieval (approximate nearest-neighbour search is the
    foundation of vector databases).  Writing it from scratch demonstrates that
    you can translate an algorithm description into vectorised NumPy code.

    ## Vectorised implementation (O(n · m · d) but all in numpy)

    """)
    return


@app.cell
def _(np):
    # --- student: begin ---

    def knn_predict(
        X_train: np.ndarray,   # [n, d]  training features
        y_train: np.ndarray,   # [n]     training labels (non-negative integers)
        X_test:  np.ndarray,   # [m, d]  test features
        k:       int,          # number of neighbours
    ) -> np.ndarray:           # [m]     predicted labels
        """kNN classifier: majority vote among the k nearest training neighbours.

        Args:
            X_train: training feature matrix, shape (n_train, n_features)
            y_train: training labels, shape (n_train,), dtype int
            X_test:  test feature matrix, shape (n_test, n_features)
            k:       number of nearest neighbours to use

        Returns:
            Predicted class labels for each test point, shape (n_test,).
            Ties broken by taking the smaller label index.
        """
        raise NotImplementedError("Implement knn_predict")

    # --- student: end ---
    return (knn_predict,)


@app.cell(hide_code=True)
def _(knn_predict, mo, np):
    def _oracle(X_train, y_train, X_test, k):
        diffs = X_test[:, np.newaxis, :] - X_train[np.newaxis, :, :]
        dists = np.sqrt((diffs ** 2).sum(axis=-1))
        knn_idx = np.argsort(dists, axis=1)[:, :k]
        knn_labels = y_train[knn_idx]
        n_classes = int(y_train.max()) + 1
        preds = []
        for row in knn_labels:
            counts = np.bincount(row, minlength=n_classes)
            preds.append(int(counts.argmax()))
        return np.array(preds)

    _solved = False
    try:
        rng = np.random.default_rng(0)

        # ── Test 1: simple 2-class, 1D ──
        _Xtr = np.array([[1.0], [2.0], [10.0], [11.0]])
        _ytr = np.array([0, 0, 1, 1])
        _Xte = np.array([[1.5], [10.5]])
        _pred = knn_predict(_Xtr, _ytr, _Xte, k=1)
        assert np.array_equal(_pred, [0, 1]), f"Test 1: expected [0,1], got {_pred.tolist()}"

        # ── Test 2: majority vote ──
        _Xtr2 = np.array([[0.0,0.0],[1.0,0.0],[0.0,1.0],[5.0,5.0]])
        _ytr2 = np.array([0, 0, 1, 1])
        _Xte2 = np.array([[0.1, 0.1]])  # nearest: (0,0),(1,0),(0,1) → 2×class0, 1×class1
        _pred2 = knn_predict(_Xtr2, _ytr2, _Xte2, k=3)
        assert _pred2[0] == 0, f"Test 2 (majority vote): expected 0, got {_pred2[0]}"

        # ── Test 3: compare to oracle on random data ──
        _n, _d, _m = 80, 4, 20
        _Xtr3 = rng.standard_normal((_n, _d))
        _ytr3 = rng.integers(0, 3, _n)
        _Xte3 = rng.standard_normal((_m, _d))
        _pred3  = knn_predict(_Xtr3, _ytr3, _Xte3, k=5)
        _oracle3 = _oracle(_Xtr3, _ytr3, _Xte3, k=5)
        assert _pred3.shape == (_m,), f"Shape: expected ({_m},), got {_pred3.shape}"
        _acc = np.mean(_pred3 == _oracle3)
        assert _acc == 1.0, \
            f"Test 3: predictions differ from oracle on {int((1-_acc)*_m)}/{_m} points"

        _result = mo.callout(mo.md(
            f"✅ `knn_predict` is correct!  "
            f"Oracle match: {int(_acc*_m)}/{_m} test points."
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
        for _fn in (knn_predict,):
            try:
                _srcs.append(_inspect.getsource(_fn))
            except Exception:
                pass
        _payload = _json.dumps({"notebookId": "ml_interview/knn_from_scratch",
                                "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps(
                {"type": "mlp:notebook-solved",
                 "notebookId": "ml_interview/knn_from_scratch"})))
            _ch.close()
        _js.fetch("/api/notebook-progress", _to_js(
            {"method": "POST", "headers": {"Content-Type": "application/json"},
             "credentials": "include", "body": _payload},
            dict_converter=_js.Object.fromEntries))
    except Exception:
        pass
    mo.output.replace(_result)
    return


if __name__ == "__main__":
    app.run()
