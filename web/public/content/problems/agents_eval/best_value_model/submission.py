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
    raise NotImplementedError("Your code here")
