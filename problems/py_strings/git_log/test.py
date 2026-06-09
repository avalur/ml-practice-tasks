import io

from tools.checks import assert_clean

WIDTH = 80


def _run(impl, records):
    log = "".join(
        f"{sha}\tFri Sep 23 10:59:32 2016 -0700\tA Author\ta@b.c\t{msg}\n"
        for sha, msg in records
    )
    out = io.StringIO()
    impl.reformat_git_log(io.StringIO(log), out)
    return out.getvalue()


def test_format_invariants(impl):
    records = [
        ("0cd8619f18d8ecad1e5d2303f95ed206c2d6f92b", "Update PEP 512 (#107)"),
        ("94dbee096b92f10ab83bbcf88102c6acdc3d76d1", "Fix github URLs"),
        ("ffffffffffffffffffffffffffffffffffffffff", "x"),
    ]
    out = _run(impl, records)
    assert out.endswith("\n")
    lines = out.split("\n")[:-1]
    assert len(lines) == len(records)
    for (sha, msg), line in zip(records, lines):
        # Independent structural spec of the output format:
        assert len(line) == WIDTH, "each line must be exactly 80 chars wide"
        assert line.startswith(sha[:7])
        assert line.endswith(msg)
        middle = line[7 : WIDTH - len(msg)]
        assert middle == "." * (WIDTH - 7 - len(msg))
        assert set(middle) <= {"."}


def test_skips_blank_lines(impl):
    out = _run(impl, [("abcdef1234567", "hello world")])
    assert out.count("\n") == 1
    assert out.startswith("abcdef1")
    assert out.rstrip("\n").endswith("hello world")


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
