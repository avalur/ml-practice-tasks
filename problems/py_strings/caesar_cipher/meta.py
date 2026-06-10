META = {
    "title": "Caesar Cipher",
    "topic": "py_strings",
    "difficulty": "easy",
    "entry": "caesar_encrypt",
    "order": 1,
    "py_deps": [],
    "banned": {},
    "hints": [
        "Map each letter to 0..25 with ord(ch) - ord('a'), add the shift mod 26, map back with chr.",
        "Handle upper- and lower-case separately; pass other characters through unchanged.",
    ],
    "statement": """
Implement `caesar_encrypt(message, n)`.

Shift every English letter `n` places along the alphabet, wrapping around and
preserving case; leave non-letters unchanged. For example
`caesar_encrypt("XYZ", 5) == "CDE"`. The shift may be negative or larger than
26 (`n` and `n % 26` behave the same), so a shift of 0, 26, or -26 returns the
text unchanged.
""",
}
