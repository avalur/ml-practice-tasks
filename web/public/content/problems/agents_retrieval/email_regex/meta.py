META = {
    "title": "Email Regex",
    "topic": "agents_retrieval",
    "difficulty": "medium",
    "entry": "email_pattern",
    "order": 2,
    "py_deps": [],
    "banned": {
        # Write the pattern. `email` and the validator packages either answer the
        # question for you or pretend to.
        "modules": ["email", "email_validator", "validators", "pydantic"],
    },
    "prereqs": ["agents_retrieval/bm25_index"],
    "hints": [
        "Build the pattern from named pieces instead of one long string: a "
        "chunk class, `chunk(?:\\.chunk)*` for the local part, a label, "
        "`(?:label\\.)+` and then the TLD. An f-string keeps it readable — "
        "remember `{2,}` has to be written `{{2,}}` inside one.",
        "A label that may not start or end with a hyphen is the two-part "
        "idiom `[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?` — the middle is "
        "optional, so a single character still matches. And the scanning rule "
        "is a negative lookahead `(?![A-Za-z0-9-])` at the very end.",
    ],
    "statement": """
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
""",
}
