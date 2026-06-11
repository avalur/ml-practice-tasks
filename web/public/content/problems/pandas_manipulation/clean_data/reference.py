import pandas as pd


def drop_dup_ids(df: pd.DataFrame, id_col: str) -> pd.DataFrame:
    """
    Remove duplicate rows based on *id_col*, keeping the **first** occurrence.

    :param df: source DataFrame
    :param id_col: column name to check for duplicates
    :return: DataFrame without duplicated id values
    """
    return df.drop_duplicates(subset=id_col)


def fill_mean(df: pd.DataFrame, col: str) -> pd.DataFrame:
    """
    Return a **copy** of *df* with ``NaN`` values in *col* replaced by the
    column's mean (computed from non-missing values only).

    :param df: source DataFrame
    :param col: numeric column that may contain ``NaN``
    :return: new DataFrame with NaN filled
    """
    df = df.copy()
    df[col] = df[col].fillna(df[col].mean())
    return df


def cast_col(df: pd.DataFrame, col: str, dtype: type) -> pd.DataFrame:
    """
    Return a **copy** of *df* with the values in *col* cast to *dtype*
    (e.g. ``float``).

    :param df: source DataFrame
    :param col: column to cast
    :param dtype: target Python / NumPy type
    :return: new DataFrame with the column recast
    """
    df = df.copy()
    df[col] = df[col].astype(dtype)
    return df
