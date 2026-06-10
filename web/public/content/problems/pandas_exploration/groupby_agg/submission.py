import pandas as pd


def total_per_group(df: pd.DataFrame, group_col: str, value_col: str) -> pd.Series:
    """
    Return the **sum** of *value_col* grouped by *group_col* as a ``pd.Series``
    indexed by the group values and named *value_col*.

    :param df: source DataFrame
    :param group_col: column to group by
    :param value_col: numeric column to sum
    :return: Series of totals, indexed by group

    Example::

        >>> data = {"city": ["A","A","B"], "sales": [10, 20, 30]}
        >>> total_per_group(pd.DataFrame(data), "city", "sales")
        city
        A    30
        B    30
        Name: sales, dtype: int64
    """
    raise NotImplementedError("Your code here")


def mean_per_group(df: pd.DataFrame, group_col: str, value_col: str) -> pd.Series:
    """
    Return the **mean** of *value_col* grouped by *group_col* as a ``pd.Series``
    indexed by the group values and named *value_col*.

    :param df: source DataFrame
    :param group_col: column to group by
    :param value_col: numeric column to average
    :return: Series of means, indexed by group
    """
    raise NotImplementedError("Your code here")
