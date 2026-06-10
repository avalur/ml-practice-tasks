def count_util(text: str, flags: str | None = None) -> dict[str, int]:
    """
    Count things in ``text`` — a tiny ``wc``-like utility. ``flags`` is a
    command-line-style string selecting which counts to return:

    * ``-m`` → ``"chars"``: number of characters (``len(text)``)
    * ``-l`` → ``"lines"``: number of newline characters
    * ``-L`` → ``"longest_line"``: length of the longest line
    * ``-w`` → ``"words"``: number of whitespace-separated words

    Flags may be combined (``"-lm"`` or ``"-l -m"``). An empty string or
    ``None`` is equivalent to ``"-mlLw"`` (all four). The result contains only
    the keys selected by the flags.

    :param text: the text to measure
    :param flags: selected flags, or None for all
    :return: mapping from selected keys to their counts
    """
    raise NotImplementedError("Your code here")
