"""Static checks that enforce per-problem constraints on a submission.

The submission source is parsed with :mod:`ast` so we can forbid ready-made
helpers (e.g. ``sklearn``/``scipy`` shortcuts) and require vectorization by
banning explicit ``for``/``while`` loops. Test code is trusted and never
checked; only the student's implementation is.
"""

from __future__ import annotations

import ast


def find_violations(source: str, banned: dict) -> list[str]:
    """Return a sorted list of human-readable constraint violations.

    ``banned`` may contain:
      * ``modules``: import roots that are not allowed (e.g. ``scipy``)
      * ``names``: identifiers/attributes that are not allowed (e.g. ``cdist``)
      * ``loops``: when truthy, ``for``/``while`` loops are not allowed
    """
    tree = ast.parse(source)
    banned_modules = set(banned.get("modules") or [])
    banned_names = set(banned.get("names") or [])
    forbid_loops = bool(banned.get("loops"))

    violations: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name.split(".")[0] in banned_modules:
                    violations.add(f"import of '{alias.name}'")
        elif isinstance(node, ast.ImportFrom):
            if (node.module or "").split(".")[0] in banned_modules:
                violations.add(f"import from '{node.module}'")
        elif isinstance(node, ast.Attribute):
            if node.attr in banned_names:
                violations.add(f"use of '{node.attr}'")
        elif isinstance(node, ast.Name):
            if node.id in banned_names:
                violations.add(f"use of '{node.id}'")
        elif forbid_loops and isinstance(node, (ast.For, ast.While, ast.AsyncFor)):
            violations.add(f"{type(node).__name__} loop")
    return sorted(violations)


def assert_clean(source: str, banned: dict) -> None:
    violations = find_violations(source, banned)
    assert not violations, "Forbidden constructs used: " + ", ".join(violations)
