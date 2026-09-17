import random
import string

import pytest

from tools.checks import assert_clean

VALID = [
    "alice@example.com",
    "bob.smith@example.co.uk",
    "a@b.co",
    "user+tag@example.org",
    "first_last%40@mail.example.com",
    "ALICE@EXAMPLE.COM",
    "x1@my-host.example.io",
    "a.b.c@d.e.fg",
    "12345@6789.dev",
]

INVALID = [
    "",
    "alice",
    "alice@",
    "@example.com",
    "alice@@example.com",
    "alice@bob@example.com",
    "alice@example",          # no TLD
    "alice@example.c",        # TLD too short
    "alice@example.c0m",      # digit in the TLD
    ".alice@example.com",     # local starts with a dot
    "alice.@example.com",     # local ends with a dot
    "al..ice@example.com",    # empty chunk
    "alice@-example.com",     # label starts with a hyphen
    "alice@example-.com",     # label ends with a hyphen
    "alice@example..com",     # empty label
    "alice@example.com.",     # trailing dot
    "alice@exa_mple.com",     # underscore in the domain
    "ali ce@example.com",
    "alice@exam ple.com",
    "alice at example.com",
    "alice@example.com123",   # would be a match without the trailing guard
]

SCANS = [
    ("Contact alice@example.com or bob.smith@sub.example.co.uk.",
     ["alice@example.com", "bob.smith@sub.example.co.uk"]),
    ("Write to ALICE@Example.COM, cc alice@example.com",
     ["alice@example.com"]),                      # one contact, first spelling
    ("ops@example.org and dev@example.org, then ops@example.org again",
     ["ops@example.org", "dev@example.org"]),      # first-appearance order
    ("<alice@example.com>, (bob@example.org); [eve@example.net]",
     ["alice@example.com", "bob@example.org", "eve@example.net"]),
    ("alice@example.com,bob@example.org",
     ["alice@example.com", "bob@example.org"]),
    ("Ticket #42 from\nalice@example.com\nreopened.", ["alice@example.com"]),
    ("no addresses here at all", []),
    ("glued to junk: alice@example.com123", []),
    ("half an address: alice@ and @example.com", []),
    ("", []),
]

# --- An independent check of the same grammar, in plain string operations.
#     Test code, so loops and str.split are fine here.
_LOCAL_CHARS = set(string.ascii_letters + string.digits + "_%+-")
_LABEL_CHARS = set(string.ascii_letters + string.digits + "-")


def _valid_local(part):
    chunks = part.split(".")
    return all(chunk and set(chunk) <= _LOCAL_CHARS for chunk in chunks)


def _valid_label(label):
    return (
        bool(label)
        and set(label) <= _LABEL_CHARS
        and label[0] != "-"
        and label[-1] != "-"
    )


def _valid_domain(part):
    labels = part.split(".")
    if len(labels) < 2 or not all(_valid_label(label) for label in labels):
        return False
    tld = labels[-1]
    return len(tld) >= 2 and set(tld) <= set(string.ascii_letters)


def _is_email(value):
    if value.count("@") != 1:
        return False
    local, _, domain = value.partition("@")
    return _valid_local(local) and _valid_domain(domain)


@pytest.mark.parametrize("value", VALID)
def test_accepts_valid_addresses(impl, value):
    assert impl.is_email(value) is True


@pytest.mark.parametrize("value", INVALID)
def test_rejects_invalid_addresses(impl, value):
    assert impl.is_email(value) is False


def test_pattern_is_a_regex_source(impl):
    pattern = impl.email_pattern()
    assert isinstance(pattern, str), "return the pattern source, not a compiled object"
    assert "@" in pattern


@pytest.mark.parametrize("text,expected", SCANS)
def test_finds_addresses_in_text(impl, text, expected):
    assert impl.find_emails(text) == expected


# Every combination of a plausible local part, a separator and a plausible
# domain — each piece chosen to sit right on one of the rules above — plus the
# same strings with one junk character glued to the end. Exhaustive rather than
# random, so a failure names itself.
LOCALS = ["", "a", "A", "alice", "a.b", ".a", "a.", "a..b", "a-b", "a_b",
          "a%b", "a+b", "a b", "a@b"]
DOMAINS = ["", "b.co", "b.c", "example.com", "EXAMPLE.COM", "sub.example.co.uk",
           "example", "example.c0m", "-example.com", "example-.com",
           "example..com", "example.com.", "exa_mple.com", "my-host.io",
           "9.dev", "exam ple.com"]
SEPARATORS = ["@", "", "@@", " @ "]
TAILS = ["", "1", "x", "-", ".", " ", "@"]


def test_matches_a_regex_free_validator(impl):
    checked = 0
    for local in LOCALS:
        for sep in SEPARATORS:
            for domain in DOMAINS:
                for tail in TAILS:
                    value = local + sep + domain + tail
                    assert impl.is_email(value) == _is_email(value), repr(value)
                    checked += 1
    assert checked > 3000  # the table above stays a table, not two examples


def test_fuzz_scanning_stays_consistent(impl):
    """Whatever comes back must be a real address really present in the text."""
    rng = random.Random(12)
    words = ["hello", "alice@example.com", "a@b.co", "@x.com", "bob@x", "-", ".",
             "ann@my-host.co.uk", "ANN@MY-HOST.CO.UK", "mail:", "x@y.com123"]
    for _ in range(300):
        text = " ".join(rng.choice(words) for _ in range(rng.randint(0, 8)))
        found = impl.find_emails(text)
        assert len(found) == len(set(found)), "duplicates must be dropped"
        lowered = text.lower()
        for address in found:
            assert address == address.lower()
            assert _is_email(address), address
            assert address in lowered, address


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
