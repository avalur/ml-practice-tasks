META = {
    "title": "Solve a Linear System",
    "topic": "numpy_linalg",
    "difficulty": "medium",
    "entry": "solve_system",
    "banned": {
        "modules": ["scipy", "sklearn"],
        "loops": True,
    },
    "hints": [
        "np.linalg.solve(A, b) returns the x satisfying A @ x == b (don't invert A explicitly).",
    ],
    "statement": """
Implement `solve_system(A, b)`.

Given a square, invertible matrix `A` of shape `(n, n)` and a vector `b` of
length `n`, return the solution `x` of the linear system `A @ x = b`. No
`for`/`while` loops.
""",
}
