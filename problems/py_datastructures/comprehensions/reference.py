import typing as tp

DEFAULT_REGION_ID = 100500


def get_unique_page_ids(records: list[tp.Mapping[str, tp.Any]]) -> set[int]:
    """Unique ``PageID`` values across the hit-log records. Use a comprehension."""
    # --- solution: begin ---
    return {r["PageID"] for r in records}
    # --- solution: end ---


def get_unique_page_ids_visited_after_ts(records: list[tp.Mapping[str, tp.Any]], ts: int) -> set[int]:
    """Unique ``PageID`` values from records whose ``EventTime`` is after ``ts`` (exclusive)."""
    # --- solution: begin ---
    return {r["PageID"] for r in records if r["EventTime"] > ts}
    # --- solution: end ---


def get_unique_user_ids_visited_page_after_ts(
        records: list[tp.Mapping[str, tp.Any]], ts: int, page_id: int) -> set[int]:
    """Unique ``UserID`` values that visited ``page_id`` after ``ts`` (exclusive)."""
    # --- solution: begin ---
    return {r["UserID"] for r in records if r["EventTime"] > ts and r["PageID"] == page_id}
    # --- solution: end ---


def get_events_by_device_type(
        records: list[tp.Mapping[str, tp.Any]], device_type: str) -> list[tp.Mapping[str, tp.Any]]:
    """Records with the given ``DeviceType``, order preserved."""
    # --- solution: begin ---
    return [r for r in records if r["DeviceType"] == device_type]
    # --- solution: end ---


def get_region_ids_with_none_replaces_by_default(records: list[tp.Mapping[str, tp.Any]]) -> list[int]:
    """``RegionID`` of each record, order preserved; ``None`` replaced by DEFAULT_REGION_ID."""
    # --- solution: begin ---
    return [r["RegionID"] if r["RegionID"] is not None else DEFAULT_REGION_ID for r in records]
    # --- solution: end ---


def get_region_id_if_not_none(records: list[tp.Mapping[str, tp.Any]]) -> list[int]:
    """``RegionID`` of each record that has one (skip ``None``), order preserved."""
    # --- solution: begin ---
    return [r["RegionID"] for r in records if r["RegionID"] is not None]
    # --- solution: end ---


def get_keys_where_value_is_not_none(r: tp.Mapping[str, tp.Any]) -> list[str]:
    """Keys of the record whose value is not ``None``."""
    # --- solution: begin ---
    return [key for key, value in r.items() if value is not None]
    # --- solution: end ---


def get_record_with_none_if_key_not_in_keys(
        r: tp.Mapping[str, tp.Any], keys: set[str]) -> dict[str, tp.Any]:
    """Same record, but values whose key is not in ``keys`` are replaced by ``None``."""
    # --- solution: begin ---
    return {key: (value if key in keys else None) for key, value in r.items()}
    # --- solution: end ---


def get_record_with_key_in_keys(
        r: tp.Mapping[str, tp.Any], keys: set[str]) -> dict[str, tp.Any]:
    """The record restricted to the entries whose key is in ``keys``."""
    # --- solution: begin ---
    return {key: value for key, value in r.items() if key in keys}
    # --- solution: end ---


def get_keys_if_key_in_keys(r: tp.Mapping[str, tp.Any], keys: set[str]) -> set[str]:
    """The record's keys that are also in ``keys``."""
    # --- solution: begin ---
    return {key for key in r if key in keys}
    # --- solution: end ---
