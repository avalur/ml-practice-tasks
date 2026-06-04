"""Shared pytest fixtures used by every problem's test file.

The same ``test.py`` runs in two places:
  * ``problems/<topic>/<slug>/`` against ``reference.py`` (CI: must be green)
  * ``tasks/<topic>/<slug>/`` against ``submission.py`` (student edits this)

The ``impl`` fixture transparently loads whichever file is present, so a
single test file works in both trees.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

import numpy as np
import pytest

_IMPL_NAMES = ("submission.py", "reference.py")


def _load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _impl_path(directory: Path) -> Path:
    for name in _IMPL_NAMES:
        path = directory / name
        if path.exists():
            return path
    raise FileNotFoundError(f"No {' or '.join(_IMPL_NAMES)} in {directory}")


@pytest.fixture
def _impl_dir(request) -> Path:
    return request.path.parent


@pytest.fixture
def impl(_impl_dir):
    path = _impl_path(_impl_dir)
    return _load_module(path, "impl_" + "_".join(_impl_dir.parts[-2:]))


@pytest.fixture
def impl_source(_impl_dir) -> str:
    return _impl_path(_impl_dir).read_text()


@pytest.fixture
def banned(_impl_dir) -> dict:
    meta_path = _impl_dir / "meta.py"
    if not meta_path.exists():
        return {}
    meta = _load_module(meta_path, "meta_" + "_".join(_impl_dir.parts[-2:])).META
    return meta.get("banned") or {}


@pytest.fixture
def rng_for():
    """Factory for a seeded NumPy generator, so tests are deterministic."""
    return lambda seed=0: np.random.default_rng(seed)
