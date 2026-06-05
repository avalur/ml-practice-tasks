META = {
    "title": "Integers to Binary Matrix",
    "topic": "numpy_manipulation",
    "difficulty": "medium",
    "entry": "to_binary",
    "banned": {
        "modules": ["scipy", "sklearn"],
        "loops": True,
    },
    "hints": [
        "Build the bit masks 2**(bits-1) … 2**0, then test each value against them with broadcasting.",
    ],
    "statement": """
Implement `to_binary(x, bits)`.

Given a 1D array `x` of non-negative integers, return a `(len(x), bits)` array
of 0/1 where row `i` is the binary representation of `x[i]`, **most
significant bit first**. No `for`/`while` loops.
""",
}
