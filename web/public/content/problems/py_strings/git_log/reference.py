import typing as tp

WIDTH = 80


def reformat_git_log(inp: tp.IO[str], out: tp.IO[str]) -> None:
    """
    Read a git log from the ``inp`` stream, reformat each record, and write it
    to the ``out`` stream.

    Each input line is tab-separated:
    ``<sha-1>\\t<date>\\t<author>\\t<email>\\t<message>``. Each output line is
    the first 7 characters of the sha, then enough dots to right-align the
    message at column 80, then the message — exactly 80 characters wide.

    :param inp: input text stream (e.g. ``io.StringIO``)
    :param out: output text stream
    :return: None (writes to ``out``)
    """
    for line in inp:
        line = line.rstrip("\n")
        if not line:
            continue
        fields = line.split("\t")
        short = fields[0][:7]
        message = fields[-1]
        dots = "." * (WIDTH - len(short) - len(message))
        out.write(short + dots + message + "\n")
