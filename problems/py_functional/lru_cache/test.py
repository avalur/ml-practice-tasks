from tools.checks import assert_clean


def test_preserves_metadata(impl):
    @impl.cache(1)
    def func(a):
        """test doc"""
        return a
    assert func.__name__ == "func"
    assert func.__doc__ == "test doc"


def test_memoizes_recursion(impl):
    # Without memoization this naive recursion is exponential; the cache makes
    # it tractable, and the math identity sum_k C(30,k) == 2**30 must hold.
    @impl.cache(1000)
    def binom(n, k):
        if k > n:
            return 0
        if k == 0:
            return 1
        return binom(n - 1, k) + binom(n - 1, k - 1)
    assert sum(binom(30, i) for i in range(31)) == 2 ** 30


def test_lru_eviction(impl):
    calls = 0
    size = 8

    @impl.cache(size)
    def ident(i):
        nonlocal calls
        calls += 1
        return i

    for i in range(size):
        ident(i)
    assert calls == size
    for i in range(size, 2 * size):  # fills cache, evicts 0..7
        ident(i)
    assert calls == 2 * size
    for i in range(size):            # 0..7 were evicted -> recompute
        ident(i)
    assert calls == 3 * size


def test_true_lru_touch(impl):
    calls = 0

    @impl.cache(2)
    def f(i):
        nonlocal calls
        calls += 1
        return i

    f(1)
    f(2)        # cache {1, 2}, calls=2
    f(1)        # hit -> 1 becomes most-recent, calls=2
    f(3)        # evict LRU (2); cache {1, 3}, calls=3
    f(1)        # still cached, calls=3
    f(2)        # 2 was evicted -> recompute, calls=4
    assert calls == 4


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
