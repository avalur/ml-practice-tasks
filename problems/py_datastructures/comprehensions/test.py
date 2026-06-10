import copy

from tools.checks import assert_clean

RECORDS = [
    {"EventID": 12345, "EventTime": 1568839214, "UserID": 12456, "PageID": 10, "RegionID": None, "DeviceType": "Safari"},
    {"EventID": 12346, "EventTime": 1568839215, "UserID": 12456, "PageID": 10, "RegionID": None, "DeviceType": "Safari"},
    {"EventID": 12347, "EventTime": 1568839216, "UserID": 12456, "PageID": 11, "RegionID": None, "DeviceType": "Safari"},
    {"EventID": 25647, "EventTime": 1568839217, "UserID": 12395, "PageID": 112, "RegionID": 10, "DeviceType": "Internet Explorer"},
    {"EventID": 12345, "EventTime": 1568839218, "UserID": 12395, "PageID": 221, "RegionID": 0, "DeviceType": "Firefox"},
    {"EventID": 15789, "EventTime": 1568839219, "UserID": 12399, "PageID": 221, "RegionID": 20, "DeviceType": "Internet Explorer"},
    {"EventID": 25647, "EventTime": 1568839217, "UserID": 12340, "PageID": 112, "RegionID": 10, "DeviceType": "Safari"},
]
RECORD = RECORDS[0]


def _records():
    return copy.deepcopy(RECORDS)


def test_unique_page_ids(impl):
    recs = _records()
    assert impl.get_unique_page_ids(recs) == {10, 11, 112, 221}
    assert recs == RECORDS


def test_unique_page_ids_after_ts(impl):
    assert impl.get_unique_page_ids_visited_after_ts(_records(), 1568839216) == {112, 221}


def test_unique_user_ids_visited_page_after_ts(impl):
    assert impl.get_unique_user_ids_visited_page_after_ts(_records(), 1568839216, 221) == {12395, 12399}


def test_events_by_device_type(impl):
    assert impl.get_events_by_device_type(_records(), "Internet Explorer") == [RECORDS[3], RECORDS[5]]


def test_region_ids_with_default(impl):
    assert impl.get_region_ids_with_none_replaces_by_default(_records()) == [100500, 100500, 100500, 10, 0, 20, 10]


def test_region_id_if_not_none(impl):
    assert impl.get_region_id_if_not_none(_records()) == [10, 0, 20, 10]


def test_keys_where_value_is_not_none(impl):
    r = copy.deepcopy(RECORD)
    assert sorted(impl.get_keys_where_value_is_not_none(r)) == sorted(
        ["EventID", "EventTime", "UserID", "PageID", "DeviceType"])
    assert r == RECORD


def test_record_with_none_if_key_not_in_keys(impl):
    assert impl.get_record_with_none_if_key_not_in_keys(copy.deepcopy(RECORD), {"EventID", "UserID"}) == {
        "EventID": 12345, "EventTime": None, "UserID": 12456,
        "PageID": None, "RegionID": None, "DeviceType": None,
    }


def test_record_with_key_in_keys(impl):
    assert impl.get_record_with_key_in_keys(copy.deepcopy(RECORD), {"EventID", "UserID"}) == {
        "EventID": 12345, "UserID": 12456}


def test_keys_if_key_in_keys(impl):
    assert impl.get_keys_if_key_in_keys(copy.deepcopy(RECORD), {"EventID", "UserID", "SomeField"}) == {
        "EventID", "UserID"}


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
