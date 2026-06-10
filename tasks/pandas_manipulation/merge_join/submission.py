import pandas as pd


def inner_merge(left: pd.DataFrame, right: pd.DataFrame, key: str) -> pd.DataFrame:
    """
    Return the **inner merge** of *left* and *right* on *key*.

    Only rows whose *key* value appears in **both** DataFrames are kept.
    When a key value has multiple matches on either side, every combination is
    included (standard SQL inner-join semantics).

    :param left: left DataFrame
    :param right: right DataFrame
    :param key: column name present in both DataFrames to join on
    :return: merged DataFrame

    Example::

        >>> orders = pd.DataFrame({"id":[1,2,3], "item":["a","b","c"]})
        >>> prices = pd.DataFrame({"id":[1,3], "price":[10,30]})
        >>> inner_merge(orders, prices, "id")
           id item  price
        0   1    a     10
        1   3    c     30
    """
    raise NotImplementedError("Your code here")
