import pandas as pd


def series_mean_and_argmax(data: dict) -> tuple:
    """
    Create a ``pd.Series`` from *data* (a dict mapping labels to numeric values)
    and return a two-element tuple ``(mean, label_of_max)``.

    * ``mean`` – the arithmetic mean of all values as a Python ``float``.
    * ``label_of_max`` – the label (key) of the largest value; if several values
      tie for the maximum, return the label that appears first in *data*.

    :param data: non-empty dict of {label: numeric_value}
    :return: (mean: float, label_of_max)

    Example::

        >>> series_mean_and_argmax({"a": 1, "b": 3, "c": 2})
        (2.0, 'b')
    """
    # --- solution: begin ---
    s = pd.Series(data)
    return float(s.mean()), s.idxmax()
    # --- solution: end ---
