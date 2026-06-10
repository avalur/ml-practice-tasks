from tools.checks import assert_clean


def test_get_squares(impl):
    assert impl.get_squares([-2, 0, 5, 2, 3, 4, 3]) == [4, 0, 25, 4, 9, 16, 9]
    assert impl.get_squares([]) == []


def test_get_indices_from_one(impl):
    assert impl.get_indices_from_one([-2, 0, 5, 2, 3, 4, 3]) == [1, 2, 3, 4, 5, 6, 7]
    assert impl.get_indices_from_one([]) == []


def test_get_max_element_index(impl):
    assert impl.get_max_element_index([-2, 0, 5, 2, 3, 4, 3]) == 2
    assert impl.get_max_element_index([]) is None


def test_get_every_second_element(impl):
    assert impl.get_every_second_element([-2, 0, 5, 2, 3, 4, 3]) == [0, 2, 4]
    assert impl.get_every_second_element([]) == []
    assert impl.get_every_second_element([1]) == []


def test_get_first_three_index(impl):
    assert impl.get_first_three_index([-2, 0, 5, 2, 3, 4, 3]) == 4
    assert impl.get_first_three_index([-2, 0, 5, 2]) is None
    assert impl.get_first_three_index([]) is None


def test_get_last_three_index(impl):
    assert impl.get_last_three_index([-2, 0, 5, 2, 3, 4, 3]) == 6
    assert impl.get_last_three_index([3, 0, 5, 2, 1, 4, 6]) == 0
    assert impl.get_last_three_index([-2, 0, 5, 2]) is None


def test_get_sum(impl):
    assert impl.get_sum([3, 0, 5, 2, 1, 4, 6]) == 21
    assert impl.get_sum([]) == 0


def test_get_min_max(impl):
    assert impl.get_min_max([3, 0, 5, 2, 1, 4, 6], 0) == (0, 6)
    assert impl.get_min_max([], 0) == (0, 0)
    assert impl.get_min_max([], None) == (None, None)


def test_get_by_index(impl):
    assert impl.get_by_index([3, 0, 5, 2, 1, 4, 6], 5, 3) == 4
    assert impl.get_by_index([3, 0, 5, 2, 1, 4, 6], 5, 4) is None


def test_inputs_not_mutated(impl):
    lst = [-2, 0, 5, 2, 3, 4, 3]
    original = list(lst)
    impl.get_squares(lst)
    impl.get_max_element_index(lst)
    impl.get_every_second_element(lst)
    impl.get_last_three_index(lst)
    assert lst == original


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
