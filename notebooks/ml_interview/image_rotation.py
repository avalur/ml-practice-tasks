import marimo

__generated_with = "0.23.9"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import numpy as np
    import matplotlib.pyplot as plt
    import io
    return io, mo, np, plt


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    # Image Rotation

    **Classic ML-interview problem**: given a colour image stored as a NumPy
    array of shape `(H, W, 3)`, rotate it by `angle_deg` degrees
    **counter-clockwise** about its centre.  Fill any pixels that fall outside
    the source image with black (`0`).

    ## Algorithm — inverse mapping

    For each output pixel `(row, col)` we ask: *"where does it come from in
    the input?"*  That is the **inverse** (clockwise) rotation:

    $$
    \begin{pmatrix} x_{\text{src}} \\ y_{\text{src}} \end{pmatrix}
    =
    \begin{pmatrix} \cos\theta & \sin\theta \\ -\sin\theta & \cos\theta \end{pmatrix}
    \begin{pmatrix} x - c_x \\ y - c_y \end{pmatrix}
    +
    \begin{pmatrix} c_x \\ c_y \end{pmatrix}
    $$

    where $(c_x, c_y) = \bigl(\tfrac{W-1}{2},\, \tfrac{H-1}{2}\bigr)$ is the image
    centre and $\theta$ is the rotation angle (positive = CCW).

    **Steps**:
    1. Convert `angle_deg` to radians.
    2. Build a grid of all output `(row, col)` coordinates with `np.mgrid`.
    3. Shift to centre-origin: `xc = col − cₓ`, `yc = row − cy`.
    4. Apply the inverse rotation matrix to get `(xc_src, yc_src)`.
    5. Shift back to image coordinates.
    6. Round to the nearest integer (**nearest-neighbour** sampling).
    7. Copy valid source pixels; leave the rest as black.
    """)
    return


@app.cell(hide_code=True)
def _(io, mo, np, plt):
    # ── Synthetic test image ──────────────────────────────────────────────
    _H, _W = 160, 160

    _ys = np.arange(_H)[:, np.newaxis]
    _xs = np.arange(_W)[np.newaxis, :]

    test_image = np.zeros((_H, _W, 3), dtype=np.uint8)
    # Warm gradient background: red from top, green from left
    test_image[:, :, 0] = (210 * _ys / (_H - 1)).astype(np.uint8)
    test_image[:, :, 1] = (160 * _xs / (_W - 1)).astype(np.uint8)
    test_image[:, :, 2] = 60
    # White L-shape in the upper-left — clearly asymmetric pointer
    test_image[12:18, 12:75] = 255       # horizontal bar (thin)
    test_image[12:75, 12:18] = 255       # vertical bar (thin)
    test_image[12:32, 12:32] = 255       # filled corner square
    # Small cyan dot in the upper-right — second asymmetry anchor
    test_image[10:22, 135:147] = [0, 210, 210]

    # Display
    _fig, _ax = plt.subplots(figsize=(3.2, 3.2))
    _ax.imshow(test_image)
    _ax.axis("off")
    _ax.set_title("Test image (rotate me!)", fontsize=11)
    plt.tight_layout()
    _buf = io.BytesIO()
    _fig.savefig(_buf, format="png", dpi=90)
    plt.close(_fig)
    _buf.seek(0)
    mo.output.replace(mo.image(src=_buf.read()))
    return (test_image,)


@app.cell
def _(np):
    # --- student: begin ---

    def rotate_image(img: np.ndarray, angle_deg: float) -> np.ndarray:
        """Rotate a colour image counter-clockwise by angle_deg degrees.

        Args:
            img:       np.ndarray of shape (H, W, 3), dtype uint8
            angle_deg: rotation angle in degrees (positive = counter-clockwise)

        Returns:
            Rotated image of the same shape and dtype as img.
            Pixels that map outside the original image are black (0).
        """
        raise NotImplementedError("Implement rotate_image")

    # --- student: end ---
    return (rotate_image,)


@app.cell(hide_code=True)
def _(io, mo, np, plt, rotate_image, test_image):
    # ── Nearest-neighbour oracle ──────────────────────────────────────────
    def _oracle(img, angle_deg):
        H, W = img.shape[:2]
        angle_rad = np.deg2rad(angle_deg)
        cos_a, sin_a = np.cos(angle_rad), np.sin(angle_rad)
        cy, cx = (H - 1) / 2.0, (W - 1) / 2.0
        rows, cols = np.mgrid[0:H, 0:W]
        rc = rows - cy
        cc = cols - cx
        # Inverse (clockwise) rotation to find source coordinates
        src_xc = cos_a * cc + sin_a * rc
        src_yc = -sin_a * cc + cos_a * rc
        src_ci = np.round(src_xc + cx).astype(int)
        src_ri = np.round(src_yc + cy).astype(int)
        out = np.zeros_like(img)
        valid = (src_ci >= 0) & (src_ci < W) & (src_ri >= 0) & (src_ri < H)
        out[valid] = img[src_ri[valid], src_ci[valid]]
        return out

    _solved = False
    try:
        # Test 1: output shape and dtype are preserved
        _out = rotate_image(test_image, 30.0)
        assert _out.shape == test_image.shape, \
            f"Shape mismatch: expected {test_image.shape}, got {_out.shape}"
        assert _out.dtype == test_image.dtype, \
            f"Dtype mismatch: expected {test_image.dtype}, got {_out.dtype}"

        # Test 2: 0° rotation must return the original exactly
        _out0 = rotate_image(test_image, 0.0)
        assert np.all(_out0 == test_image), \
            "0° rotation must return an image identical to the input"

        # Test 3: causal property — rotating (5, 16) by 90° CCW in a 33×33 image
        # should put the bright pixel near (16, 27).
        _H33 = 33
        _dot = np.zeros((_H33, _H33, 3), dtype=np.uint8)
        _dot[5, 16] = 255
        _rot90 = rotate_image(_dot, 90.0)
        _bright = np.where(_rot90[:, :, 0] > 128)
        assert len(_bright[0]) > 0, \
            "After 90° CCW rotation, the bright pixel should still be visible"
        _r_mean = float(_bright[0].mean())
        _c_mean = float(_bright[1].mean())
        assert abs(_r_mean - 16) < 2 and abs(_c_mean - 27) < 2, (
            f"After 90° CCW: pixel at (5, 16) should land near (16, 27), "
            f"got ({_r_mean:.1f}, {_c_mean:.1f}).  "
            f"Check your inverse-rotation formula and angle sign."
        )

        # Test 4: compare to oracle on random images at several angles
        _rng = np.random.default_rng(7)
        _small = _rng.integers(0, 256, (40, 40, 3), dtype=np.uint8)
        for _a in [15.0, 45.0, 90.0, 135.0]:
            _student = rotate_image(_small, _a)
            _ref = _oracle(_small, _a)
            _diff = np.abs(_student.astype(np.int32) - _ref.astype(np.int32))
            assert _diff.mean() < 8.0, (
                f"At {_a}°: mean pixel diff vs oracle is {_diff.mean():.2f} "
                f"(threshold 8). Bilinear interpolation is fine too — "
                f"check your rotation direction and centre computation."
            )

        # ── Show original vs rotated side-by-side ────────────────────────
        _rotated45 = rotate_image(test_image, 45.0)
        _fig, (_ax1, _ax2) = plt.subplots(1, 2, figsize=(6.4, 3.2))
        _ax1.imshow(test_image); _ax1.axis("off"); _ax1.set_title("Original")
        _ax2.imshow(_rotated45);  _ax2.axis("off"); _ax2.set_title("Rotated 45° CCW")
        plt.tight_layout()
        _buf = io.BytesIO()
        _fig.savefig(_buf, format="png", dpi=90)
        plt.close(_fig)
        _buf.seek(0)

        _result = mo.vstack([
            mo.image(src=_buf.read()),
            mo.callout(mo.md("✅ `rotate_image` is correct!"), kind="success"),
        ])
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
        for _fn in (rotate_image,):
            try:
                _srcs.append(_inspect.getsource(_fn))
            except Exception:
                pass
        _payload = _json.dumps({"notebookId": "ml_interview/image_rotation",
                                "code": "\n\n".join(_srcs), "solved": bool(_solved)})
        if _solved:
            _ch = _js.BroadcastChannel.new("mlp-notebooks")
            _ch.postMessage(_js.JSON.parse(_json.dumps(
                {"type": "mlp:notebook-solved",
                 "notebookId": "ml_interview/image_rotation"})))
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
