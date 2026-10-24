from types import SimpleNamespace

from app.services.generator import GenerationConfig, generate_candidate, requirement_summary


def requirement(identifier="r1", group="g1", teacher="t1", subject="s1", duration=60, count=1, room_type="classroom"):
    return SimpleNamespace(id=identifier, class_group_id=group, teacher_id=teacher, subject_id=subject, duration_minutes=duration, weekly_count=count, room_type=room_type, session_type="Lecture")


def room(identifier="room1", room_type="classroom"):
    return SimpleNamespace(id=identifier, room_type=room_type)


def config(**overrides):
    values = dict(working_days=["monday", "tuesday"], daily_start=540, daily_end=660, quantum=30, time_limit_seconds=3, preference="earlier")
    values.update(overrides)
    return GenerationConfig(**values)


def test_generator_places_variable_duration_sessions_without_overlap():
    result = generate_candidate(None, [requirement(duration=50, count=2)], [], [], [room()], config())
    assert result["status"] in {"OPTIMAL", "FEASIBLE"}
    assert len(result["sessions"]) == 2
    assert all(item["end_minute"] - item["start_minute"] == 50 for item in result["sessions"])


def test_generator_respects_shared_teacher_and_room_between_groups():
    result = generate_candidate(None, [requirement("r1", "g1"), requirement("r2", "g2")], [], [], [room()], config())
    assert result["status"] in {"OPTIMAL", "FEASIBLE"}
    assert result["sessions"][0]["day"] != result["sessions"][1]["day"] or result["sessions"][0]["start_minute"] != result["sessions"][1]["start_minute"]


def test_generator_rejects_unavailable_teacher_window():
    unavailable = SimpleNamespace(teacher_id="t1", day_of_week="monday", start_minute=540, end_minute=660, available=False)
    result = generate_candidate(None, [requirement()], [], [unavailable], [room()], config(working_days=["monday"]))
    assert result["status"] == "INFEASIBLE"


def test_generator_requires_compatible_laboratory():
    result = generate_candidate(None, [requirement(room_type="laboratory")], [], [], [room(room_type="classroom")], config())
    assert result["status"] == "INFEASIBLE"


def test_generator_preserves_existing_shared_resource_booking():
    existing = SimpleNamespace(id="saved", class_group_id="other", teacher_id="t1", room_id="room1", day_of_week="monday", start_minute=540, end_minute=600)
    result = generate_candidate(None, [requirement()], [existing], [], [room()], config(working_days=["monday"], daily_end=660))
    assert result["status"] in {"OPTIMAL", "FEASIBLE"}
    assert result["sessions"][0]["start_minute"] >= 600
