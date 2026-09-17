import numpy as np
import pytest

from tools.checks import assert_clean

SHAPES = [(6, 4, 2), (5, 5, 1), (3, 8, 3), (7, 2, 2)]  # out, in, rank


def _effective(weight, A, B, alpha, rank):
    """W + (alpha/rank) * B @ A, one element at a time (test code: loops are fine)."""
    out_features, in_features = weight.shape
    eff = np.array(weight, dtype=float)
    for i in range(out_features):
        for j in range(in_features):
            delta = 0.0
            for r in range(rank):
                delta += B[i, r] * A[r, j]
            eff[i, j] += alpha / rank * delta
    return eff


def _forward(x, weight, A, B, alpha, rank):
    """The layer's output, without a single matrix product."""
    eff = _effective(weight, A, B, alpha, rank)
    out = np.zeros((x.shape[0], weight.shape[0]))
    for n in range(x.shape[0]):
        for i in range(weight.shape[0]):
            for j in range(weight.shape[1]):
                out[n, i] += x[n, j] * eff[i, j]
    return out


def _trained(impl, rng_for, out_features, in_features, rank, alpha=2.0, seed=0):
    """A layer whose adapter has been moved off its initial value."""
    rng = rng_for(seed)
    weight = rng.standard_normal((out_features, in_features))
    layer = impl.LoRALinear(weight, rank, alpha, rng)
    # B starts at zero by design, so nothing interesting happens until training
    # does something to it. Stand in for that here.
    layer.A = rng.standard_normal((rank, in_features)) / np.sqrt(in_features)
    layer.B = rng.standard_normal((out_features, rank)) * 0.1
    return layer, weight


@pytest.mark.parametrize("out_features,in_features,rank", SHAPES)
def test_forward_matches_bruteforce(impl, rng_for, out_features, in_features, rank):
    layer, weight = _trained(impl, rng_for, out_features, in_features, rank)
    x = rng_for(7).standard_normal((5, in_features))
    got = layer.forward(x)
    assert got.shape == (5, out_features)
    np.testing.assert_allclose(
        got, _forward(x, weight, layer.A, layer.B, layer.alpha, layer.rank),
        rtol=1e-9, atol=1e-12,
    )


@pytest.mark.parametrize("out_features,in_features,rank", SHAPES)
def test_merged_weight_matches_bruteforce(impl, rng_for, out_features, in_features, rank):
    layer, weight = _trained(impl, rng_for, out_features, in_features, rank)
    merged = layer.merged_weight()
    assert merged.shape == weight.shape
    np.testing.assert_allclose(
        merged, _effective(weight, layer.A, layer.B, layer.alpha, layer.rank),
        rtol=1e-9, atol=1e-12,
    )


def test_merging_is_exact(impl, rng_for):
    """The whole deployment story: the merged layer is the adapted layer."""
    layer, _ = _trained(impl, rng_for, 6, 4, 2)
    x = rng_for(3).standard_normal((4, 4))
    np.testing.assert_allclose(
        layer.forward(x), x @ layer.merged_weight().T, rtol=1e-9, atol=1e-12
    )


def test_training_starts_at_the_base_model(impl, rng_for):
    """B is zero at init, so the fresh adapter must change nothing at all."""
    rng = rng_for(1)
    weight = rng.standard_normal((6, 4))
    layer = impl.LoRALinear(weight, 2, 8.0, rng)
    x = rng.standard_normal((5, 4))
    np.testing.assert_allclose(layer.forward(x), x @ weight.T, rtol=1e-12, atol=1e-14)
    np.testing.assert_allclose(layer.merged_weight(), weight, rtol=1e-12, atol=1e-14)


def test_adapter_initialisation(impl, rng_for):
    rng = rng_for(2)
    in_features = 400
    layer = impl.LoRALinear(np.zeros((30, in_features)), 4, 1.0, rng)
    assert layer.A.shape == (4, in_features)
    assert layer.B.shape == (30, 4)
    assert not np.any(layer.B), "B must start at zero"
    assert np.any(layer.A), "A must not start at zero, or no gradient can flow"
    # Scaled by 1/sqrt(in_features): ~0.05 here, not ~1 (unscaled) and not
    # ~0.0025 (scaled by 1/in_features).
    assert 0.02 < float(np.std(layer.A)) < 0.12


def test_alpha_scales_the_adapter_only(impl, rng_for):
    weak, weight = _trained(impl, rng_for, 6, 4, 2, alpha=1.0)
    strong, _ = _trained(impl, rng_for, 6, 4, 2, alpha=3.0)
    x = rng_for(5).standard_normal((4, 4))
    base = x @ weight.T
    np.testing.assert_allclose(
        strong.forward(x) - base, 3.0 * (weak.forward(x) - base), rtol=1e-9, atol=1e-12
    )


@pytest.mark.parametrize("out_features,in_features,rank", SHAPES)
def test_the_update_is_low_rank(impl, rng_for, out_features, in_features, rank):
    layer, weight = _trained(impl, rng_for, out_features, in_features, rank)
    delta = layer.merged_weight() - weight
    assert np.linalg.matrix_rank(delta) <= rank
    assert np.any(np.abs(delta) > 1e-9), "the adapter should have moved something"


def test_the_base_weight_is_frozen(impl, rng_for):
    layer, _ = _trained(impl, rng_for, 6, 4, 2)
    before = np.array(layer.weight)
    x = rng_for(4).standard_normal((3, 4))
    layer.forward(x)
    merged = layer.merged_weight()
    layer.trainable_fraction()
    np.testing.assert_array_equal(layer.weight, before)
    assert merged is not layer.weight, "merged_weight must return a new array"
    merged[0, 0] += 100.0
    np.testing.assert_array_equal(layer.weight, before)


@pytest.mark.parametrize(
    "out_features,in_features,rank,want",
    [(512, 256, 8, 6144 / 131072), (1024, 1024, 8, 16384 / 1048576), (4, 4, 4, 2.0)],
)
def test_trainable_fraction(impl, rng_for, out_features, in_features, rank, want):
    layer = impl.LoRALinear(
        np.zeros((out_features, in_features)), rank, 1.0, rng_for(0)
    )
    assert layer.trainable_fraction() == pytest.approx(want)


def test_single_row_batch(impl, rng_for):
    layer, weight = _trained(impl, rng_for, 6, 4, 2)
    x = rng_for(8).standard_normal((1, 4))
    got = layer.forward(x)
    assert got.shape == (1, 6)
    np.testing.assert_allclose(
        got, _forward(x, weight, layer.A, layer.B, layer.alpha, layer.rank),
        rtol=1e-9, atol=1e-12,
    )


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
