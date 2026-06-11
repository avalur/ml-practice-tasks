import pandas as pd


def build_multiindex(df: pd.DataFrame, index_cols: list) -> pd.DataFrame:
    """
    Set *index_cols* as a hierarchical **MultiIndex** and return the
    reindexed DataFrame.

    :param df: flat DataFrame
    :param index_cols: list of column names to use as the MultiIndex levels
    :return: DataFrame with a MultiIndex

    Example::

        >>> df = pd.DataFrame({"city":["A","A"],"year":[2022,2023],"sales":[10,20]})
        >>> build_multiindex(df, ["city","year"])
                      sales
        city year
        A    2022       10
             2023       20
    """
    return df.set_index(index_cols)


def unstack_level(df: pd.DataFrame, level) -> pd.DataFrame:
    """
    **Unstack** *level* of the MultiIndex, pivoting that index level into new
    column labels and returning a DataFrame with a wider shape.

    :param df: DataFrame with a MultiIndex
    :param level: index level to unstack (int position or label string)
    :return: unstacked DataFrame

    Example::

        >>> mi_df = build_multiindex(df, ["city","year"])
        >>> unstack_level(mi_df, "year")
              sales
        year   2022  2023
        city
        A        10    20
    """
    return df.unstack(level=level)
