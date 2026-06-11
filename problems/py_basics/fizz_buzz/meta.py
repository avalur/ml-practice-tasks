META = {
    "title": "Fizz Buzz",
    "topic": "py_basics",
    "difficulty": "easy",
    "entry": "get_fizz_buzz",
    "order": 2,
    "py_deps": [],
    "banned": {},
    "next": ["py_basics/iterate_me"],
    "hints": [
        "Loop the numbers 1..n; check divisibility by 15 first, then 3, then 5, else keep the number.",
    ],
    "statement": """
Implement `get_fizz_buzz(n)`.

Return a list of length `n`. Position `i` (0-based) describes the number
`i + 1`: `"FizzBuzz"` if it is divisible by 15, `"Fizz"` if divisible by 3,
`"Buzz"` if divisible by 5, otherwise the number itself. For example
`get_fizz_buzz(5) == [1, 2, "Fizz", 4, "Buzz"]`.
""",
}
