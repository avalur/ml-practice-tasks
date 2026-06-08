META = {
    "title": "RGBA Color Dtype",
    "topic": "numpy_basics",
    "difficulty": "easy",
    "entry": "rgba_dtype",
    "order": 8,
    "banned": {},
    "hints": [
        "np.dtype([(name, type), ...]) builds a structured dtype; np.uint8 is an unsigned byte.",
    ],
    "statement": """
Implement `rgba_dtype()`.

Return a custom NumPy structured `dtype` that describes a color as four
unsigned bytes: fields named `"r"`, `"g"`, `"b"`, `"a"`, each an unsigned
8-bit integer (`np.uint8`). The dtype should occupy 4 bytes in total.
""",
}
