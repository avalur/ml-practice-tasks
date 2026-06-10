import typing as tp

DEFAULT_REGION_ID = 100500


def get_unique_page_ids(records: list[tp.Mapping[str, tp.Any]]) -> set[int]:
    """Unique ``PageID`` values across the hit-log records. Use a comprehension."""
    raise NotImplementedError("Your code here")


def get_unique_page_ids_visited_after_ts(records: list[tp.Mapping[str, tp.Any]], ts: int) -> set[int]:
    """Unique ``PageID`` values from records whose ``EventTime`` is after ``ts`` (exclusive)."""
    raise NotImplementedError("Your code here")


def get_unique_user_ids_visited_page_after_ts(
        records: list[tp.Mapping[str, tp.Any]], ts: int, page_id: int) -> set[int]:
    """Unique ``UserID`` values that visited ``page_id`` after ``ts`` (exclusive)."""
    raise NotImplementedError("Your code here")


def get_events_by_device_type(
        records: list[tp.Mapping[str, tp.Any]], device_type: str) -> list[tp.Mapping[str, tp.Any]]:
    """Records with the given ``DeviceType``, order preserved."""
    raise NotImplementedError("Your code here")


def get_region_ids_with_none_replaces_by_default(records: list[tp.Mapping[str, tp.Any]]) -> list[int]:
    """``RegionID`` of each record, order preserved; ``None`` replaced by DEFAULT_REGION_ID."""
    raise NotImplementedError("Your code here")


def get_region_id_if_not_none(records: list[tp.Mapping[str, tp.Any]]) -> list[int]:
    """``RegionID`` of each record that has one (skip ``None``), order preserved."""
    raise NotImplementedError("Your code here")


def get_keys_where_value_is_not_none(r: tp.Mapping[str, tp.Any]) -> list[str]:
    """Keys of the record whose value is not ``None``."""
    raise NotImplementedError("Your code here")


def get_record_with_none_if_key_not_in_keys(
        r: tp.Mapping[str, tp.Any], keys: set[str]) -> dict[str, tp.Any]:
    """Same record, but values whose key is not in ``keys`` are replaced by ``None``."""
    raise NotImplementedError("Your code here")


def get_record_with_key_in_keys(
        r: tp.Mapping[str, tp.Any], keys: set[str]) -> dict[str, tp.Any]:
    """The record restricted to the entries whose key is in ``keys``."""
    raise NotImplementedError("Your code here")


def get_keys_if_key_in_keys(r: tp.Mapping[str, tp.Any], keys: set[str]) -> set[str]:
    """The record's keys that are also in ``keys``."""
    raise NotImplementedError("Your code here")
