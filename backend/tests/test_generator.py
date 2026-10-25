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


def test_balanced_preference_uses_morning_when_teacher_is_available_then():
    afternoon_only = SimpleNamespace(teacher_id="t1", day_of_week="monday", start_minute=720, end_minute=900, available=True)
    result = generate_candidate(None, [requirement()], [], [afternoon_only], [room()], config(working_days=["monday"], daily_end=900, preference="balanced"))
    assert result["status"] in {"OPTIMAL", "FEASIBLE"}
    assert result["sessions"][0]["start_minute"] >= 720


def test_balanced_preference_starts_early_when_morning_is_available():
    result = generate_candidate(None, [requirement()], [], [], [room()], config(working_days=["monday"], daily_end=900, preference="balanced"))
    assert result["status"] in {"OPTIMAL", "FEASIBLE"}
    assert result["sessions"][0]["start_minute"] == 540


def test_generator_requires_compatible_laboratory():
    result = generate_candidate(None, [requirement(room_type="laboratory")], [], [], [room(room_type="classroom")], config())
    assert result["status"] == "INFEASIBLE"


def test_generator_preserves_existing_shared_resource_booking():
    existing = SimpleNamespace(id="saved", class_group_id="other", teacher_id="t1", room_id="room1", day_of_week="monday", start_minute=540, end_minute=600)
    result = generate_candidate(None, [requirement()], [existing], [], [room()], config(working_days=["monday"], daily_end=660))
    assert result["status"] in {"OPTIMAL", "FEASIBLE"}
    assert result["sessions"][0]["start_minute"] >= 600


def test_large_owner_like_request_returns_feasible_without_waiting_for_balanced_optimum():
    requirements = [requirement("lecture", teacher="t1", subject="s1", count=7), requirement("tutorial", teacher="t1", subject="s1", count=2), requirement("database", teacher="t2", subject="s2", count=5)]
    result = generate_candidate(None, requirements, [], [], [room("room1"), room("room2"), room("room3")], config(working_days=["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"], daily_end=1020, quantum=30, preference="balanced", time_limit_seconds=10))
    assert result["status"] == "FEASIBLE"
    assert len(result["sessions"]) == 14
    assert all(item["end_minute"] - item["start_minute"] == 60 for item in result["sessions"])


def test_ten_minute_resolution_preserves_consecutive_forty_minute_periods():
    result = generate_candidate(None, [requirement(duration=40, count=2)], [], [], [room()], config(working_days=["monday"], daily_end=660, quantum=10))
    assert result["status"] in {"OPTIMAL", "FEASIBLE"}
    assert all(item["end_minute"] - item["start_minute"] == 40 for item in result["sessions"])
    assert all(item["start_minute"] % 10 == 0 for item in result["sessions"])
