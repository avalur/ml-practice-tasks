import math
import re
import typing as tp
from collections import Counter


def tokenize(text: str) -> list[str]:
    """Lowercase the text and keep every run of letters and digits.

    Given — use it as it is, so that your index and the tests agree on what a
    term is.
    """
    return re.findall(r"[a-z0-9]+", text.lower())


class BM25Index:
    """
    A BM25 index over a fixed collection of documents — the keyword half of a
    RAG retriever, the part that answers "which documents mention this?".

    A document is identified by its position in ``documents``. ``__init__``
    does the *offline* work: tokenize each document once and precompute
    everything a query needs. ``search`` does the *online* work, and it is only
    allowed to tokenize **the query** — re-tokenizing the collection per search
    is the mistake this task exists to prevent.

    ``_score_tokens(tokens, doc_id)`` is the BM25 score of one document against
    an already-tokenized query::

                                            tf(t, D) * (k1 + 1)
        score(D) = SUM  idf(t) * -----------------------------------------
                   t in tokens   tf(t, D) + k1 * (1 - b + b * |D| / avgdl)

                           N - df(t) + 0.5
        idf(t) = ln( 1 + ------------------- )
                             df(t) + 0.5

    where ``tf(t, D)`` is how many times ``t`` occurs in document ``D``,
    ``df(t)`` is how many documents contain ``t`` at all, ``N`` is the number of
    documents, ``|D|`` is the token count of ``D`` and ``avgdl`` is the mean
    document length. Three details that decide whether your numbers match:

    * query tokens are summed **with their duplicates** — "cat cat" counts
      twice;
    * a token that occurs in no document contributes nothing, because its
      ``tf`` is 0 (no special case needed);
    * this ``idf`` is the Lucene variant. The ``1 +`` keeps it positive even for
      a term that occurs in every document, so a score is above 0 **exactly**
      when the document contains at least one query token.

    ``search(query, top_k)`` returns at most ``top_k`` ``(doc_id, score)``
    pairs, highest score first, ties broken by the smaller ``doc_id``, and only
    documents scoring above 0 — a document sharing no token with the query is
    not a result, so fewer than ``top_k`` pairs come back when fewer match.

    ``documents`` is non-empty and at least one of them has a token; a single
    document may well be empty. ``k1`` and ``b`` are the usual knobs: ``k1``
    sets how fast term frequency saturates, ``b`` how hard long documents are
    penalized (``b = 0`` turns length normalization off).
    """

    def __init__(
        self, documents: tp.Sequence[str], k1: float = 1.5, b: float = 0.75
    ) -> None:
        self.k1 = k1
        self.b = b
        # --- solution: begin ---
        self.doc_count = len(documents)
        # Per document: its length in tokens, and its term -> tf counts.
        self._lengths: list[int] = []
        self._freqs: list[dict[str, int]] = []
        # The inverted index: term -> the ids of the documents containing it.
        # This is what lets search score only the candidates.
        self._postings: dict[str, list[int]] = {}
        for doc_id, text in enumerate(documents):
            tokens = tokenize(text)
            counts = Counter(tokens)
            self._lengths.append(len(tokens))
            self._freqs.append(counts)
            for term in counts:
                self._postings.setdefault(term, []).append(doc_id)
        self._avgdl = sum(self._lengths) / self.doc_count
        self._idf = {
            term: math.log(1 + (self.doc_count - len(ids) + 0.5) / (len(ids) + 0.5))
            for term, ids in self._postings.items()
        }
        # --- solution: end ---

    def _score_tokens(self, tokens: tp.Sequence[str], doc_id: int) -> float:
        # --- solution: begin ---
        freqs = self._freqs[doc_id]
        norm = self.k1 * (
            1 - self.b + self.b * self._lengths[doc_id] / self._avgdl
        )
        total = 0.0
        for term in tokens:
            tf = freqs.get(term, 0)
            if tf:
                total += self._idf[term] * tf * (self.k1 + 1) / (tf + norm)
        return total
        # --- solution: end ---

    def score(self, query: str, doc_id: int) -> float:
        """BM25 score of one document against a raw query. Wiring given: both
        entry points tokenize once and share the same per-document scorer."""
        return self._score_tokens(tokenize(query), doc_id)

    def search(self, query: str, top_k: int = 5) -> list[tuple[int, float]]:
        # --- solution: begin ---
        tokens = tokenize(query)
        candidates = {
            doc_id for term in set(tokens) for doc_id in self._postings.get(term, ())
        }
        # Every candidate scores above 0 (tf >= 1 and this idf is positive), so
        # the candidate set *is* the result set — only the order is left.
        ranked = [(doc_id, self._score_tokens(tokens, doc_id)) for doc_id in candidates]
        ranked.sort(key=lambda pair: (-pair[1], pair[0]))
        return ranked[:top_k]
        # --- solution: end ---
