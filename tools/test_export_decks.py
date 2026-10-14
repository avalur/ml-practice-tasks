"""Unit tests for content pipeline assignment support in export_decks.py.

Run directly:
    pytest tools/test_export_decks.py -q
"""

from __future__ import annotations

import pytest

from export_decks import expand_item, item_href, lesson_items, validate_items


def test_expand_assignment_minimal() -> None:
    item = {"type": "assignment", "id": "agents_hw1", "title": "Build a ReAct Agent"}
    resolved, errors = expand_item(item, set(), set(), "test")
    assert errors == []
    assert resolved == {
        "type": "assignment",
        "id": "agents_hw1",
        "title": "Build a ReAct Agent",
    }


def test_expand_assignment_full() -> None:
    item = {
        "type": "assignment",
        "id": "agents_hw2",
        "title": "Build a Tool-Calling Agent",
        "templateHref": "https://colab.research.google.com/drive/xyz",
        "maxScore": 50,
    }
    resolved, errors = expand_item(item, set(), set(), "test")
    assert errors == []
    assert resolved == {
        "type": "assignment",
        "id": "agents_hw2",
        "title": "Build a Tool-Calling Agent",
        "templateHref": "https://colab.research.google.com/drive/xyz",
        "maxScore": 50,
    }


def test_expand_assignment_invalid_id() -> None:
    invalid_ids = [
        " a/b ",
        "x ",
        " x",
        "agents_*",
        "a/b",
        "",
        "A_B",
        "-abc",
        "_abc",
        "abc/def",
        None,
        123,
    ]
    for invalid in invalid_ids:
        item = {"type": "assignment", "id": invalid, "title": "Test Title"}
        resolved, errors = expand_item(item, set(), set(), "test")
        assert resolved is None
        assert any("assignment id must be a lowercase slug" in e for e in errors)


def test_expand_assignment_missing_title() -> None:
    for invalid_title in ["", "   ", None]:
        item = {"type": "assignment", "id": "agents_hw1", "title": invalid_title}
        resolved, errors = expand_item(item, set(), set(), "test")
        assert resolved is None
        assert any("needs a non-empty title" in e for e in errors)


def test_expand_assignment_invalid_template_href() -> None:
    item = {
        "type": "assignment",
        "id": "agents_hw1",
        "title": "HW1",
        "templateHref": "relative/path/not/allowed",
    }
    resolved, errors = expand_item(item, set(), set(), "test")
    assert resolved is None
    assert any("templateHref needs an absolute url or path" in e for e in errors)


def test_expand_assignment_invalid_max_score() -> None:
    for invalid in [True, False, 0, -10, "100", 25.5]:
        item = {
            "type": "assignment",
            "id": "agents_hw1",
            "title": "HW1",
            "maxScore": invalid,
        }
        resolved, errors = expand_item(item, set(), set(), "test")
        assert resolved is None
        assert any("maxScore must be a positive integer" in e for e in errors)


def test_item_href_behavior() -> None:
    assert item_href({"type": "problem", "id": "py_basics/sum"}) == "/problems/py_basics/sum"
    assert item_href({"type": "notebook", "id": "numpy/indexing"}) == "/notebooks/numpy/indexing"
    with pytest.raises(ValueError, match="No direct URL"):
        item_href({"type": "assignment", "id": "hw1"})
    with pytest.raises(ValueError, match="No direct URL"):
        item_href({"type": "link", "title": "Colab", "href": "https://colab.research.google.com"})


def test_assignment_placement_in_practice_and_homework() -> None:
    lesson = {
        "slug": "l01-intro",
        "title": "Intro",
        "practice": [
            {"type": "assignment", "id": "practice_nb", "title": "In-class Notebook"}
        ],
        "homework": {
            "due": "2026-10-20T23:59",
            "items": [
                {
                    "type": "assignment",
                    "id": "homework_nb",
                    "title": "Homework Notebook",
                    "templateHref": "https://colab.research.google.com/xyz",
                    "maxScore": 100,
                }
            ],
        },
    }
    practice, homework, errors = lesson_items(lesson, set(), set(), "test_class/l01-intro")
    assert errors == []
    assert len(practice) == 1
    assert practice[0] == {
        "type": "assignment",
        "id": "practice_nb",
        "title": "In-class Notebook",
    }
    assert len(homework) == 1
    assert homework[0] == {
        "type": "assignment",
        "id": "homework_nb",
        "title": "Homework Notebook",
        "templateHref": "https://colab.research.google.com/xyz",
        "maxScore": 100,
    }


def test_lesson_payload_manifest_structure() -> None:
    lesson = {
        "slug": "l01-intro",
        "title": "Intro",
        "deck": "intro_deck",
        "practice": [
            {
                "type": "assignment",
                "id": "practice_nb",
                "title": "In-class Notebook",
            }
        ],
        "homework": {
            "due": "2026-10-20T23:59",
            "items": [
                {
                    "type": "assignment",
                    "id": "homework_nb",
                    "title": "Homework Notebook",
                    "templateHref": "https://colab.research.google.com/xyz",
                    "maxScore": 50,
                }
            ],
        },
    }
    practice, hw_items, errors = lesson_items(lesson, set(), set(), "test_class/l01-intro")
    assert errors == []
    payload = {
        "slug": lesson["slug"],
        "title": lesson["title"],
        "deck": lesson["deck"],
        "practice": practice,
        "homework": {**lesson["homework"], "items": hw_items},
    }
    assert payload["practice"][0]["type"] == "assignment"
    assert payload["homework"]["items"][0]["type"] == "assignment"
    assert payload["homework"]["items"][0]["templateHref"] == "https://colab.research.google.com/xyz"
    assert payload["homework"]["items"][0]["maxScore"] == 50


def test_validate_items_duplicate_assignment_id_rejected() -> None:
    cls = {
        "slug": "test-class",
        "lessons": [
            {
                "slug": "l01",
                "practice": [
                    {"type": "assignment", "id": "duplicate_id", "title": "Assignment 1"}
                ],
            },
            {
                "slug": "l02",
                "homework": {
                    "due": "2026-10-20T23:59",
                    "items": [
                        {"type": "assignment", "id": "duplicate_id", "title": "Assignment 2"}
                    ],
                },
            },
        ],
    }
    errors = validate_items(cls, set(), set())
    assert any("duplicate assignment id 'duplicate_id'" in e for e in errors)
