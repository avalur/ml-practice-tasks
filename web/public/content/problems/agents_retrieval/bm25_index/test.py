import math
import random
import re

import pytest

from tools.checks import assert_clean

DOCS = [
    "Agents call tools to act on the world",
    "A tool call returns a result the agent reads",
    "BM25 ranks documents by keyword overlap",
    "Embeddings rank documents by meaning, not by keywords",
    "The retriever puts retrieved documents into the prompt",
    "",  # an empty document can never match
    "keyword keyword keyword keyword keyword",
]

QUERIES = [
    "documents",
    "keyword",
    "keyword keyword",
    "tool call",
    "Agents, tools and TOOLS!",
    "retrieved documents in the prompt",
    "zebra",  # in no document
    "",
]


def _words(text):
    # Same terms as the given tokenize(), reached the other way round: split on
    # everything that is not a letter or a digit.
    return [w for w in re.split(r"[^a-z0-9]+", text.lower()) if w]


def _oracle(documents, query, k1=1.5, b=0.75):
    """BM25 straight from the formula: no index, everything recomputed."""
    docs = [_words(d) for d in documents]
    avgdl = sum(len(d) for d in docs) / len(docs)
    scores = []
    for words in docs:
        total = 0.0
        for term in _words(query):
            tf = words.count(term)
            if tf == 0:
                continue
            df = sum(1 for other in docs if term in other)
            idf = math.log(1 + (len(docs) - df + 0.5) / (df + 0.5))
            norm = k1 * (1 - b + b * len(words) / avgdl)
            total += idf * tf * (k1 + 1) / (tf + norm)
        scores.append(total)
    return scores


def _oracle_search(documents, query, top_k, **kwargs):
    scores = _oracle(documents, query, **kwargs)
    hits = [(i, s) for i, s in enumerate(scores) if s > 0]
    hits.sort(key=lambda pair: (-pair[1], pair[0]))
    return hits[:top_k]


@pytest.mark.parametrize("query", QUERIES)
def test_score_matches_the_formula(impl, query):
    index = impl.BM25Index(DOCS)
    expected = _oracle(DOCS, query)
    for doc_id, want in enumerate(expected):
        assert index.score(query, doc_id) == pytest.approx(want)


@pytest.mark.parametrize("query", QUERIES)
@pytest.mark.parametrize("top_k", [0, 1, 3, 100])
def test_search_ranks_and_truncates(impl, query, top_k):
    got = impl.BM25Index(DOCS).search(query, top_k)
    want = _oracle_search(DOCS, query, top_k)
    assert [doc_id for doc_id, _ in got] == [doc_id for doc_id, _ in want]
    for (_, score), (_, expected) in zip(got, want):
        assert score == pytest.approx(expected)


def test_only_matching_documents_come_back(impl):
    index = impl.BM25Index(DOCS)
    assert index.search("zebra", 5) == []
    assert index.search("", 5) == []
    # Documents 2 and 6 say "keyword"; document 3 says "keywords", which is a
    # different term to a keyword index, and the empty document 5 has none.
    matched = {doc_id for doc_id, _ in index.search("keyword", 10)}
    assert matched == {2, 6}
    assert all(score > 0 for _, score in index.search("documents tool", 10))


@pytest.mark.parametrize("k1,b", [(0.5, 0.0), (1.2, 1.0), (2.0, 0.3), (1.5, 0.75)])
def test_k1_and_b_are_used(impl, k1, b):
    index = impl.BM25Index(DOCS, k1=k1, b=b)
    expected = _oracle(DOCS, "tool documents keyword", k1=k1, b=b)
    for doc_id, want in enumerate(expected):
        assert index.score("tool documents keyword", doc_id) == pytest.approx(want)


def test_shorter_document_ranks_higher(impl):
    # Same term, same count, different length: b > 0 must prefer the short one.
    docs = ["tools tools", "tools tools padding padding padding padding"]
    assert [doc_id for doc_id, _ in impl.BM25Index(docs).search("tools", 2)] == [0, 1]


def test_rarer_term_contributes_more(impl):
    # "rare" is in one document of four, "common" in three. One hit of each,
    # in documents of equal length — so idf alone decides the order.
    docs = ["rare shared", "common shared", "common filler", "common filler"]
    ranked = impl.BM25Index(docs).search("rare common", 4)
    assert ranked[0][0] == 0
    assert ranked[0][1] > ranked[1][1]


def test_term_frequency_saturates(impl):
    # b=0 removes length normalization, so only tf moves the score. Going from
    # one occurrence to two must be worth more than going from five to six.
    docs = ["x", "x x", "x x x x x", "x x x x x x"]
    index = impl.BM25Index(docs, b=0.0)
    scores = [index.score("x", doc_id) for doc_id in range(4)]
    assert scores[1] - scores[0] > scores[3] - scores[2] > 0


def test_the_index_is_built_in_init(impl, monkeypatch):
    index = impl.BM25Index(DOCS)
    want = _oracle_search(DOCS, "tool call", 3)
    calls = []
    real = impl.tokenize

    def counted(text):
        calls.append(text)
        return real(text)

    # Patched *after* the index is built, so what it counts is the search.
    monkeypatch.setattr(impl, "tokenize", counted)
    got = index.search("tool call", 3)

    assert [doc_id for doc_id, _ in got] == [doc_id for doc_id, _ in want]
    assert len(calls) <= 1, (
        f"search tokenized {len(calls)} strings; it may only tokenize the "
        "query — the documents are tokenized once, in __init__"
    )


def test_fuzz(impl):
    rng = random.Random(25)
    vocab = ["agent", "tool", "mcp", "prompt", "chunk", "rank", "index"]
    for _ in range(30):
        docs = [
            " ".join(rng.choice(vocab) for _ in range(rng.randint(0, 8)))
            for _ in range(rng.randint(2, 6))
        ]
        if not any(docs):
            continue  # avgdl would be 0; the docstring rules that corpus out
        query = " ".join(rng.choice(vocab) for _ in range(rng.randint(1, 3)))
        top_k = rng.randint(0, 4)
        got = impl.BM25Index(docs).search(query, top_k)
        want = _oracle_search(docs, query, top_k)
        assert [doc_id for doc_id, _ in got] == [doc_id for doc_id, _ in want]
        for (_, score), (_, expected) in zip(got, want):
            assert score == pytest.approx(expected)


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
