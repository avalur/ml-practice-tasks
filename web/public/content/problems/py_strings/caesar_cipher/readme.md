# Caesar Cipher

**Topic:** `py_strings` &nbsp;|&nbsp; **Difficulty:** easy

Implement `caesar_encrypt(message, n)`.

Shift every English letter `n` places along the alphabet, wrapping around and
preserving case; leave non-letters unchanged. For example
`caesar_encrypt("XYZ", 5) == "CDE"`. The shift may be negative or larger than
26 (`n` and `n % 26` behave the same), so a shift of 0, 26, or -26 returns the
text unchanged.

## How to run

```bash
pytest tasks/py_strings/caesar_cipher
```
Edit `submission.py` until every test passes.
