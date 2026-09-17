import numpy as np


class LoRALinear:
    """
    A frozen linear layer with a trainable low-rank adapter — LoRA, the
    "efficiency method" of the two ways to give an agent long-term knowledge.

    The plain layer computes ``x @ W.T`` for a base weight ``W`` of shape
    ``(out_features, in_features)`` (the torch convention: row ``i`` of ``W``
    holds the weights of output ``i``). LoRA never touches ``W``; it learns a
    low-rank correction next to it::

        W_eff = W + (alpha / rank) * B @ A

    ``A`` is ``(rank, in_features)`` and ``B`` is ``(out_features, rank)``, so
    the whole update is `rank * (in_features + out_features)` numbers instead of
    `in_features * out_features`. The ``alpha / rank`` factor is LoRA's scaling:
    it keeps the size of the update roughly independent of the rank you happened
    to pick, so changing the rank does not force you to retune the learning rate.

    What ``__init__(weight, rank, alpha, rng)`` stores, and the tests read:

    * ``weight`` — the base, exactly the array handed in. It is **frozen**:
      nothing in this class may ever write into it.
    * ``A`` — ``(rank, in_features)``, drawn as
      ``rng.standard_normal(...) / sqrt(in_features)`` from the given numpy
      Generator, so its rows stay O(1) however wide the layer is.
    * ``B`` — ``(out_features, rank)``, **all zeros**. Not an implementation
      detail: with ``B = 0`` the adapter contributes nothing, so training starts
      at exactly the base model instead of at a randomly damaged one. ``A`` is
      random for the mirror reason — were both zero, no gradient could ever
      flow into either.
    * ``rank``, ``alpha`` — as given.

    Three methods:

    * ``forward(x)`` — the output for a batch ``x`` of shape
      ``(batch, in_features)``, shaped ``(batch, out_features)``. Group the
      products as ``(x @ A.T) @ B.T``: that way the full ``out x in`` correction
      is never built, which is what makes the adapter cheap at run time.
    * ``merged_weight()`` — the one matrix ``W_eff`` above, as a **new** array.
      Fold it in and inference costs exactly what it did before: a single
      linear layer, no adapter in sight.
    * ``trainable_fraction()`` — the adapter's parameter count over the base's,
      ``(A.size + B.size) / weight.size``. This is the number that sells LoRA.
    """

    def __init__(
        self,
        weight: np.ndarray,
        rank: int,
        alpha: float,
        rng: np.random.Generator,
    ) -> None:
        raise NotImplementedError("Your code here")

    def forward(self, x: np.ndarray) -> np.ndarray:
        raise NotImplementedError("Your code here")

    def merged_weight(self) -> np.ndarray:
        raise NotImplementedError("Your code here")

    def trainable_fraction(self) -> float:
        raise NotImplementedError("Your code here")
