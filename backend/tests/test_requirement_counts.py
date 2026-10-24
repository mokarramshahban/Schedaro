from types import SimpleNamespace

from app.services.generator import requirement_summary


def req(count=2, duration=60, session_type="Lecture", teacher="t1"):
    return SimpleNamespace(id="r1", class_group_id="g1", subject_id="s1", teacher_id=teacher, session_type=session_type, weekly_count=count, duration_minutes=duration, room_type="classroom")


def session(identifier, start, end, session_type="Lecture", teacher="t1", group="g1"):
    return SimpleNamespace(id=identifier, class_group_id=group, subject_id="s1", teacher_id=teacher, session_type=session_type, start_minute=start, end_minute=end)


def test_existing_matching_sessions_reduce_remaining_count():
    result = requirement_summary(req(count=2), [session("a", 540, 600), session("b", 660, 720)])
    assert result["scheduled_count"] == 2
    assert result["remaining_count"] == 0


def test_partial_matching_sessions_require_only_the_remainder():
    result = requirement_summary(req(count=4), [session("a", 540, 600), session("b", 660, 720)])
    assert result["scheduled_count"] == 2
    assert result["remaining_count"] == 2


def test_duration_mismatch_is_not_counted_or_resized():
    result = requirement_summary(req(count=1, duration=60), [session("long", 540, 720)])
    assert result["scheduled_count"] == 0
    assert result["remaining_count"] == 1
    assert result["duration_mismatch_count"] == 1
    assert "different duration" in result["warning"]


def test_type_teacher_and_group_scope_prevent_cross_requirement_counting():
    result = requirement_summary(req(count=1), [session("tutorial", 540, 600, session_type="Tutorial"), session("other-teacher", 660, 720, teacher="t2"), session("other-group", 780, 840, group="g2")])
    assert result["scheduled_count"] == 0
    assert result["remaining_count"] == 1
    assert result["teacher_mismatch_count"] == 1
    assert "different teacher" in result["warning"]
