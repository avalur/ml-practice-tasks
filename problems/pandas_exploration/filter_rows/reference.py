import pandas as pd


def filter_rows(
    df: pd.DataFrame,
    max_age: int,
    name_starts: tuple,
    excl_surname: str,
) -> pd.DataFrame:
    """
    Filter *df* (which has columns ``'name'``, ``'surname'``, ``'age'``) and
    return only the rows that satisfy **all three** conditions:

    1. ``age <= max_age``
    2. ``name`` starts with one of the prefixes in *name_starts*
    3. ``surname != excl_surname``

    Use **boolean indexing** — ``.query()`` is not allowed.
    The returned DataFrame keeps the original index labels (no reset).

    :param df: source DataFrame
    :param max_age: maximum age (inclusive)
    :param name_starts: tuple of string prefixes, e.g. ``('A', 'D')``
    :param excl_surname: surname value to exclude
    :return: filtered DataFrame

    Example::

        >>> data = {"name": ["Adam","Bob","Dolly","Anna"],
        ...         "surname": ["Brown","Smith","Brown","Jones"],
        ...         "age": [23, 45, 22, 30]}
        >>> filter_rows(pd.DataFrame(data), 35, ("A", "D"), "Brown")
           name surname  age
        3  Anna   Jones   30
    """
    # --- solution: begin ---
    mask = (
        (df["age"] <= max_age)
        & df["name"].str.startswith(name_starts)
        & (df["surname"] != excl_surname)
    )
    return df[mask]
    # --- solution: end ---
