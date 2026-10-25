from types import SimpleNamespace

from app.services.generator import GenerationConfig, generate_candidate


def req(count=1, identifier="r1", group="g1", duration=60):
    return SimpleNamespace(id=identifier, class_group_id=group, teacher_id=f"t-{identifier}", subject_id=f"s-{identifier}", duration_minutes=duration, weekly_count=count, room_type="classroom", session_type="Lecture")


def room():
    return SimpleNamespace(id="room-1", room_type="classroom")


def run(requirements, days, existing=None, preference="balanced", daily_end=660):
    return generate_candidate(None, requirements, existing or [], [], [room()], GenerationConfig(working_days=days, daily_start=540, daily_end=daily_end, quantum=30, time_limit_seconds=5, preference=preference))


def test_balanced_six_sessions_use_six_working_days():
    result = run([req(count=6)], ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"])
    assert result["status"] in {"OPTIMAL", "FEASIBLE"}
    assert {item["day"] for item in result["sessions"]} == {"monday", "tuesday", "wednesday", "thursday", "friday", "saturday"}


def test_balanced_six_sessions_across_five_days_do_not_concentrate_on_monday():
    days = ["monday", "tuesday", "wednesday", "thursday", "friday"]
    result = run([req(count=6)], days)
    counts = {day: sum(item["day"] == day for item in result["sessions"]) for day in days}
    assert max(counts.values()) <= 2
    assert min(counts.values()) >= 1


def test_existing_monday_minutes_influence_balanced_workload():
    existing = [SimpleNamespace(id="saved-1", class_group_id="g1", teacher_id="other", room_id="other-room", day_of_week="monday", start_minute=540, end_minute=600)]
    result = run([req(count=1)], ["monday", "tuesday"], existing)
    assert result["status"] in {"OPTIMAL", "FEASIBLE"}
    assert result["sessions"][0]["day"] == "tuesday"


def test_earlier_preference_uses_clock_time_not_weekday_order():
    days = ["monday", "tuesday"]
    result = run([req(count=2)], days, preference="earlier")
    assert result["status"] in {"OPTIMAL", "FEASIBLE"}
    assert {item["day"] for item in result["sessions"]} == set(days)
    assert all(item["start_minute"] == 540 for item in result["sessions"])


def test_balanced_preference_discourages_consecutive_same_subject_sessions():
    result = run([req(count=6)], ["monday", "tuesday", "wednesday"], preference="balanced", daily_end=900)
    assert result["status"] in {"OPTIMAL", "FEASIBLE"}
    by_day = {}
    for session in result["sessions"]:
        by_day.setdefault(session["day"], []).append(session)
    assert all(len(sessions) == 2 for sessions in by_day.values())
    assert any(session["start_minute"] != 540 for session in result["sessions"])
    for sessions in by_day.values():
        ordered = sorted(sessions, key=lambda item: item["start_minute"])
        assert all(left["end_minute"] != right["start_minute"] for left, right in zip(ordered, ordered[1:]))
