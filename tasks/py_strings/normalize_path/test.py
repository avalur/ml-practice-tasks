import pytest

from tools.checks import assert_clean

# (path, expected) — ground-truth normalizations. Note these differ from
# os.path.normpath on a few inputs (e.g. "//"), so the table is the oracle.
CASES = [
    ("foo", "foo"),
    ("./bar", "bar"),
    ("", "."),
    (".", "."),
    ("/", "/"),
    ("//", "/"),
    ("/..//..//././///././/..//../", "/"),
    ("..", ".."),
    ("../", ".."),
    ("../..", "../.."),
    ("a/b/c/d/../../../..", "."),
    ("zog/..", "."),
    ("./config/../etc", "etc"),
    ("foo/./bar", "foo/bar"),
    ("a/..///../b", "../b"),
    ("./../../../zog", "../../../zog"),
    ("/////documents/root/.././../etc", "/etc"),
    ("/../../../zog", "/zog"),
    ("/foo/bar//baz/asdf/quux/..", "/foo/bar/baz/asdf"),
    ("/h/../a/.." * 1000, "/"),
    ("/a/b//c/d/..//../..//.." * 1000, "/"),
    ("a/b//c/d/..//../..//../" * 1000, "."),
]


@pytest.mark.parametrize("path, expected", CASES)
def test_normalize(impl, path, expected):
    assert impl.normalize_path(path) == expected


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
