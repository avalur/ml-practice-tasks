META = {
    "title": "BM25 Index",
    "topic": "agents_retrieval",
    "difficulty": "medium",
    "entry": "BM25Index",
    "order": 1,
    "py_deps": [],
    "banned": {
        # Every one of these ships BM25 or TF-IDF ready-made; the formula is the
        # whole lesson, so build the index and the score by hand.
        "modules": ["rank_bm25", "bm25s", "sklearn", "gensim", "nltk", "whoosh"],
    },
    "next": ["agents_retrieval/email_regex"],
    "hints": [
        "__init__ is the offline half: per document keep its token count and a "
        "Counter of its terms, plus one dict term -> [doc ids containing it] "
        "(the inverted index) and the idf of every term you saw.",
        "search is the online half: tokenize the query once, take the union of "
        "the query terms' posting lists as the candidates, score only those, "
        "then sort by (-score, doc_id) and cut to top_k.",
    ],
    "statement": """
Build a **BM25 index** — the keyword retriever behind the lexical half of a RAG
pipeline, the part that answers "which documents mention this?".

`BM25Index(documents, k1=1.5, b=0.75)` indexes a collection once; a document is
identified by its position in `documents`. `search(query, top_k)` then returns
at most `top_k` `(doc_id, score)` pairs, highest score first, ties broken by the
smaller `doc_id`, and **only** documents scoring above 0 — a document that
shares no term with the query is not a result.

The score of document `D` for a query is a sum over the query's tokens
(duplicates included — "cat cat" counts twice):

```
                                    tf(t, D) * (k1 + 1)
score(D) = SUM  idf(t) * -----------------------------------------
           t in q        tf(t, D) + k1 * (1 - b + b * |D| / avgdl)

                   N - df(t) + 0.5
idf(t) = ln( 1 + ------------------- )
                     df(t) + 0.5
```

`tf(t, D)` is how often `t` occurs in `D`, `df(t)` how many documents contain
`t` at all, `N` the number of documents, `|D|` the token count of `D` and
`avgdl` the mean document length. That `1 +` in the idf is the Lucene variant:
it keeps the idf positive even for a term present in every document, which is
what makes "score above 0" mean exactly "contains a query term".

`tokenize` is given — use it, so your terms and the tests' agree. The
collection is non-empty and at least one document has a token, but a single
document may well be empty. The split between the two halves of the pipeline is
part of the task: **`__init__` tokenizes the collection, `search` may only
tokenize the query** — so the per-document scoring lives in `_score_tokens`,
which both entry points share.
""",
}
