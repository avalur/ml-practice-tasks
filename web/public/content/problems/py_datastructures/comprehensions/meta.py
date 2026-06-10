META = {
    "title": "Comprehensions Over Records",
    "topic": "py_datastructures",
    "difficulty": "medium",
    "entry": "get_unique_page_ids",
    "order": 6,
    "py_deps": [],
    "banned": {
        "loops": True,
        "names": ["map", "filter"],
    },
    "hints": [
        "Each function is one list/set/dict comprehension over the records — e.g. {r['PageID'] for r in records}.",
        "Add an `if` clause to filter; use a conditional expression (a if cond else b) for the default-value cases.",
    ],
    "statement": """
Ten little extractors over a hit-log: each record is a dict with `EventID`,
`EventTime`, `UserID`, `PageID`, `RegionID` (may be `None`), `DeviceType`.
Write **each as a single comprehension** — no `for`/`while` loops and no
`map`/`filter`:

- `get_unique_page_ids` — set of all `PageID`s.
- `get_unique_page_ids_visited_after_ts(records, ts)` — `PageID`s with
  `EventTime > ts`.
- `get_unique_user_ids_visited_page_after_ts(records, ts, page_id)` — `UserID`s
  that hit `page_id` after `ts`.
- `get_events_by_device_type(records, device_type)` — records with that device
  (order preserved).
- `get_region_ids_with_none_replaces_by_default(records)` — each `RegionID`,
  with `None` → `DEFAULT_REGION_ID` (100500).
- `get_region_id_if_not_none(records)` — the non-`None` `RegionID`s.
- `get_keys_where_value_is_not_none(r)` — keys of a record with a non-`None` value.
- `get_record_with_none_if_key_not_in_keys(r, keys)` — same record, values whose
  key isn't in `keys` set to `None`.
- `get_record_with_key_in_keys(r, keys)` — the record restricted to `keys`.
- `get_keys_if_key_in_keys(r, keys)` — the record's keys that are in `keys`.
""",
}
