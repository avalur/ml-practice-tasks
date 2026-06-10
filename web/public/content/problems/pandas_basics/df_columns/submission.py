import pandas as pd


def make_dataframe(columns: dict) -> pd.DataFrame:
    """
    Create and return a ``pd.DataFrame`` from *columns*, a dict mapping
    column names to lists of values.  The column order matches the dict's
    insertion order.

    :param columns: ``{column_name: [v1, v2, ...]}``
    :return: DataFrame with those columns

    Example::

        >>> make_dataframe({"x": [1, 2], "y": [3, 4]})
           x  y
        0  1  3
        1  2  4
    """
    raise NotImplementedError("Your code here")


def add_product_column(df: pd.DataFrame, col_a: str, col_b: str, result: str) -> pd.DataFrame:
    """
    Return a **copy** of *df* with a new column *result* = ``df[col_a] * df[col_b]``.
    The original DataFrame must not be mutated.

    :param df: input DataFrame
    :param col_a: name of the first factor column
    :param col_b: name of the second factor column
    :param result: name of the new column
    :return: new DataFrame with the extra column appended
    """
    raise NotImplementedError("Your code here")
