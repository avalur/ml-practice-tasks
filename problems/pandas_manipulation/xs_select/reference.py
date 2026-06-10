import pandas as pd


def xs_by_level(df: pd.DataFrame, key, level) -> pd.DataFrame:
    """
    Select a cross-section of *df* by *key* at the given MultiIndex *level*,
    using ``DataFrame.xs()``.

    :param df: DataFrame with a MultiIndex on the columns **or** rows
    :param key: the value to select (e.g. 2022, ``"Sales"``)
    :param level: the level name or integer position
    :return: cross-section DataFrame

    Example (column MultiIndex)::

        >>> df.columns   # MultiIndex: (metric, year)
        >>> xs_by_level(df, 2022, level=1)  # all 2022 columns
    """
    # --- solution: begin ---
    return df.xs(key, axis=1, level=level)
    # --- solution: end ---


def swaplevel_select(df: pd.DataFrame, key) -> pd.DataFrame:
    """
    Select columns matching *key* from a column MultiIndex by first swapping
    the two levels with ``swaplevel()`` and then indexing with *key*.

    :param df: DataFrame with a 2-level column MultiIndex (level 0 = metric,
               level 1 = year / sub-label)
    :param key: value from the *original* level 1 to select
    :return: DataFrame with only the columns where original level 1 == key
    """
    # --- solution: begin ---
    return df.swaplevel(axis=1)[key]
    # --- solution: end ---
