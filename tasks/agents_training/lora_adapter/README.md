# LoRA Adapter

**Topic:** `agents_training` &nbsp;|&nbsp; **Difficulty:** medium

Implement `LoRALinear` — a frozen linear layer with a trainable **low-rank
adapter**. This is LoRA, the cheap way to bake knowledge into an agent's
weights: instead of fine-tuning `W`, you train a small correction beside it.

A plain layer computes `x @ W.T` for a base weight `W` of shape
`(out_features, in_features)`. LoRA leaves `W` alone and adds:

```
W_eff = W + (alpha / rank) * B @ A      A: (rank, in_features)
                                        B: (out_features, rank)
```

so the update is `rank * (in_features + out_features)` numbers instead of
`in_features * out_features`. The `alpha / rank` factor keeps the size of the
update roughly independent of the rank you picked, so changing the rank does not
force you to retune the learning rate.

`__init__(weight, rank, alpha, rng)` stores `weight` (the array as given — it is
**frozen**, never write into it), `rank`, `alpha`, and builds the two adapter
matrices: `A` from `rng.standard_normal(...) / sqrt(in_features)`, and `B` as
**all zeros**. That zero is the point: it makes the adapter a no-op, so training
starts at exactly the base model rather than at a randomly damaged one — while
`A` must be random, or no gradient could ever flow into either matrix.

Then three methods:

- `forward(x)` — output for a batch `x` of shape `(batch, in_features)`. Group
  the products as `(x @ A.T) @ B.T`, which never builds the full
  `out_features x in_features` correction; that is why the adapter is cheap.
- `merged_weight()` — `W_eff` as a **new** array. Fold it in and inference costs
  what it always did: one linear layer.
- `trainable_fraction()` — `(A.size + B.size) / weight.size`, the number that
  sells LoRA. (Try `rank` equal to the full width to see it stop selling.)

## Constraints

- Forbidden modules: torch, peft, transformers, loralib
- Explicit `for`/`while` loops are not allowed (vectorize it)

## How to run

```bash
pytest tasks/agents_training/lora_adapter
```
Edit `submission.py` until every test passes.
