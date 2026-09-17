import re


def email_pattern() -> str:
    """
    Return the regex **source** for one email address, as a string.

    This is the metadata half of a retrieval pipeline: before a chunk goes into
    the index you pull the entities out of it, and a contact address is the one
    every support corpus is full of. A keyword index cannot help you here — the
    tokenizer of the BM25 task shreds ``alice@example.com`` into three
    unrelated terms — so the address has to be recognized by its shape.

    "Valid" is not RFC 5322 (nobody wants that regex). It is this, and the tests
    hold you to exactly it — ``local@domain`` where:

    * **local** is one or more *chunks* joined by single dots, and each chunk is
      one or more of ``A-Za-z0-9_%+-``. So no leading or trailing dot and no
      ``..`` — ``a.b@…`` passes, ``.a@…``, ``a.@…`` and ``a..b@…`` do not.
    * **domain** is two or more *labels* joined by single dots. A label starts
      and ends with a letter or a digit and may carry hyphens inside
      (``my-host`` yes, ``-host`` and ``host-`` no). The last label is the TLD:
      letters only, at least two of them. So ``example.com`` and
      ``sub.example.co.uk`` pass; ``example`` (no TLD), ``example.c`` (too
      short) and ``example.c0m`` (a digit) do not.
    * Upper case is allowed everywhere a letter is.

    One more rule, and it is the whole reason this is a task rather than a
    one-liner: the pattern is used **both** to validate one string and to scan
    running text. An address may not be followed immediately by a letter, digit
    or hyphen — otherwise scanning ``alice@example.com123`` would happily report
    ``alice@example.com``, an address that is not in that text. A pattern that
    looks perfect under ``fullmatch`` is still wrong under ``finditer`` until it
    refuses to end in the middle of a token.
    """
    # --- solution: begin ---
    local = r"[A-Za-z0-9_%+-]+(?:\.[A-Za-z0-9_%+-]+)*"
    label = r"[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?"
    return rf"{local}@(?:{label}\.)+[A-Za-z]{{2,}}(?![A-Za-z0-9-])"
    # --- solution: end ---


def is_email(value: str) -> bool:
    """One address and nothing else. Wiring given — the pattern does the work."""
    return re.fullmatch(email_pattern(), value) is not None


def find_emails(text: str) -> list[str]:
    """
    Every address in ``text``, **lower-cased** and without duplicates, in order
    of first appearance.

    Addresses are case-insensitive in practice, and what you want on a chunk is
    the set of contacts it mentions — so ``Ann@X.COM`` and ``ann@x.com`` are one
    entry, the one that appeared first.
    """
    # --- solution: begin ---
    found = (m.group(0).lower() for m in re.finditer(email_pattern(), text))
    return list(dict.fromkeys(found))  # dict keeps first-seen order
    # --- solution: end ---
