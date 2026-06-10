from tools.checks import assert_clean


def test_virtual_attrs_not_declared(impl):
    # The shortcuts must come from __getattr__/__setattr__, not be declared.
    declared = impl.ListTwist.__dict__.keys()
    for name in ("reversed", "R", "first", "F", "last", "L", "size", "S"):
        assert name not in declared


def test_empty(impl):
    lst = impl.ListTwist()
    assert lst.data == []
    assert lst.reversed == [] and lst.R == []
    assert lst.size == 0 and lst.S == 0


def test_get_shortcuts(impl):
    lst = impl.ListTwist([1, "a", [3]])
    assert lst == [1, "a", [3]]
    assert lst.reversed == [[3], "a", 1]
    assert lst.R == [[3], "a", 1]
    assert lst.first == 1 and lst.F == 1
    assert lst.last == [3] and lst.L == [3]
    assert lst.size == 3 and lst.S == 3


def test_from_iterable(impl):
    lst = impl.ListTwist("cba")
    assert lst.data == ["c", "b", "a"]
    assert lst.first == "c" and lst.last == "a"


def test_tracks_mutations(impl):
    lst = impl.ListTwist([2])
    lst.append(4)
    lst += [5]
    assert lst.data == [2, 4, 5]
    assert lst.R == [5, 4, 2]
    assert lst.last == 5 and lst.size == 3
    assert lst.pop() == 5
    assert lst.size == 2


def test_set_first_last(impl):
    lst = impl.ListTwist([6, 4, 5])
    lst.first = 8
    assert lst.data == [8, 4, 5]
    lst.L = 9
    assert lst.data == [8, 4, 9]


def test_set_size_grow_and_shrink(impl):
    lst = impl.ListTwist([6, 4, 5])
    lst.size = 5
    assert lst.data == [6, 4, 5, None, None]
    assert lst.last is None
    lst.S = 2
    assert lst.data == [6, 4]
    assert lst.last == 4


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
