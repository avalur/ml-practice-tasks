import pandas as pd


def sort_by_surname_age(df: pd.DataFrame) -> pd.DataFrame:
    """
    Sort *df* (columns ``'name'``, ``'surname'``, ``'age'``) by two keys:

    1. **surname** — descending (Z before A)
    2. **age** — ascending (younger first) among rows that share the same surname

    The original index is preserved (no reset).

    :param df: DataFrame with at least columns 'surname' and 'age'
    :return: sorted DataFrame

    Example::

        >>> data = {"name":["Alice","Bob","Carol"],
        ...         "surname":["Smith","Brown","Smith"],
        ...         "age":[30,25,20]}
        >>> sort_by_surname_age(pd.DataFrame(data))
           name surname  age
        2  Carol   Smith   20
        0  Alice   Smith   30
        1    Bob   Brown   25
    """
    raise NotImplementedError("Your code here")
