import pandas as pd


def loc_select(df: pd.DataFrame, row_labels: list, col_labels: list) -> pd.DataFrame:
    """
    Select a sub-DataFrame by **label** using ``.loc[]``.

    :param df: DataFrame with labelled index and columns
    :param row_labels: list of row index labels to select
    :param col_labels: list of column names to select
    :return: DataFrame with the selected rows and columns

    Example::

        >>> df = pd.DataFrame({"A":[1,2,3],"B":[4,5,6]}, index=["r1","r2","r3"])
        >>> loc_select(df, ["r1","r3"], ["A"])
            A
        r1  1
        r3  3
    """
    # --- solution: begin ---
    return df.loc[row_labels, col_labels]
    # --- solution: end ---


def iloc_select(df: pd.DataFrame, row_positions: list, col_positions: list) -> pd.DataFrame:
    """
    Select a sub-DataFrame by **integer position** using ``.iloc[]``.

    :param df: any DataFrame
    :param row_positions: list of integer row positions (0-based)
    :param col_positions: list of integer column positions (0-based)
    :return: DataFrame with the selected rows and columns

    Example::

        >>> df = pd.DataFrame({"A":[1,2,3],"B":[4,5,6],"C":[7,8,9]})
        >>> iloc_select(df, [0, 2], [0, 2])
           A  C
        0  1  7
        2  3  9
    """
    # --- solution: begin ---
    return df.iloc[row_positions, col_positions]
    # --- solution: end ---
