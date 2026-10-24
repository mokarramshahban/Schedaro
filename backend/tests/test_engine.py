import json

import schedaro_engine


def session(session_id: str, *, term: str = "term-a", group: str = "group-a", day: str = "monday", start: int = 540, end: int = 600, teacher: str = "teacher-a", room: str = "room-a"):
    return {"id": session_id, "academic_term_id": term, "class_group_id": group, "day": day, "start_minute": start, "end_minute": end, "teacher_id": teacher, "room_id": room}


def validate(candidate, existing):
    return json.loads(schedaro_engine.validate_schedule(json.dumps({"candidate": candidate, "existing": existing})))['conflicts']


def test_consecutive_sessions_are_allowed():
    assert validate(session("new", start=600, end=660), [session("old")]) == []


def test_partial_overlap_reports_class_teacher_and_room():
    conflicts = validate(session("new", start=600, end=690), [session("old", start=630, end=720)])
    assert {item["kind"] for item in conflicts} == {"class_group", "teacher", "room"}


def test_cross_scope_and_weekday_sessions_are_ignored():
    candidate = session("new")
    assert validate(candidate, [session("other-day", day="tuesday"), session("other-term", term="term-b")]) == []


def test_self_exclusion_and_invalid_interval():
    candidate = session("same")
    assert validate(candidate, [candidate]) == []
    invalid = session("invalid", start=700, end=699)
    assert validate(invalid, []) [0]["kind"] == "invalid_interval"
