from __future__ import annotations

import typing as tp


def best_value_model(
    leaderboard: list[dict[str, tp.Any]],
    min_score: float = 0.0,
) -> str | None:
    """Find the model with the highest quality-per-dollar efficiency on the leaderboard.

    Each model in ``leaderboard`` is a dict with:
      * ``name`` (str): Model identifier.
      * ``score`` (float): Benchmark quality metric (e.g. solve rate, % or points).
      * ``input_tokens`` (int): Total input/prompt tokens consumed across the benchmark.
      * ``output_tokens`` (int): Total output/completion tokens generated.
      * ``input_cost_per_m`` (float): Price in USD per 1,000,000 input tokens.
      * ``output_cost_per_m`` (float): Price in USD per 1,000,000 output tokens.

    Total cost in USD is calculated as::

               input_tokens * input_cost_per_m + output_tokens * output_cost_per_m
        cost = -------------------------------------------------------------------
                                           1,000,000

    Efficiency is defined as::

        efficiency = score / cost  (quality points per dollar)

    Only models with ``cost > 0`` and ``score >= min_score`` are eligible.
    Ties in efficiency are broken by higher ``score``, and then by whichever
    candidate appears earlier in ``leaderboard``.

    :param leaderboard: List of model evaluation records.
    :param min_score: Minimum benchmark score required to qualify (default: 0.0).
    :return: Name of the winning model, or None if no candidate qualifies.
    """
    best_candidate: dict[str, tp.Any] | None = None
    best_key: tuple[float, float] | None = None

    for model in leaderboard:
        score = float(model.get("score", 0.0))
        if score < min_score:
            continue

        inp_tokens = int(model.get("input_tokens", 0))
        out_tokens = int(model.get("output_tokens", 0))
        inp_price = float(model.get("input_cost_per_m", 0.0))
        out_price = float(model.get("output_cost_per_m", 0.0))

        cost = (inp_tokens * inp_price + out_tokens * out_price) / 1_000_000.0
        if cost <= 0.0:
            continue

        eff = score / cost
        key = (eff, score)
        if best_key is None or key > best_key:
            best_key = key
            best_candidate = model

    return best_candidate["name"] if best_candidate is not None else None
