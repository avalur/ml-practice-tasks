# Email Regex

**Topic:** `agents_retrieval` &nbsp;|&nbsp; **Difficulty:** medium

Write the regex that finds email addresses — the metadata step of a retrieval
pipeline, where you pull the entities out of a chunk before indexing it. A
keyword index is no help here: the tokenizer from
[BM25 Index](/problems/agents_retrieval/bm25_index) shreds `alice@example.com`
into three unrelated terms, so an address has to be recognized by its shape.

`email_pattern()` returns the pattern **source** as a string; `is_email` is
given and just runs it with `fullmatch`. "Valid" is not RFC 5322 — nobody wants
that regex — it is exactly this:

- **local part** — one or more *chunks* joined by single dots, each chunk one or
  more of `A-Za-z0-9_%+-`. So `a.b@…` passes; `.a@…`, `a.@…` and `a..b@…` do not.
- **domain** — two or more *labels* joined by single dots. A label starts and
  ends with a letter or digit and may carry hyphens inside: `my-host` yes,
  `-host` and `host-` no. The last label is the TLD: letters only, at least two.
  So `example.com` and `sub.example.co.uk` pass; `example`, `example.c` and
  `example.c0m` do not.
- Upper case is allowed wherever a letter is.

Then `find_emails(text)` returns every address in a document, **lower-cased**,
without duplicates, in order of first appearance — addresses are
case-insensitive in practice, and what you want on a chunk is the set of
contacts it mentions.

That second function is why the pattern needs one more rule, and why this is a
task rather than a one-liner: an address may not be followed immediately by a
letter, digit or hyphen. Without that, scanning `alice@example.com123` reports
`alice@example.com` — an address that is *not* in that text. A pattern that
looks perfect under `fullmatch` is still wrong under `finditer` until it refuses
to end in the middle of a token.

## Constraints

- Forbidden modules: email, email_validator, validators, pydantic

## How to run

```bash
pytest tasks/agents_retrieval/email_regex
```
Edit `submission.py` until every test passes.
