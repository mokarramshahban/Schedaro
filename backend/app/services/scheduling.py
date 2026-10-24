import json
from collections.abc import Iterable
from typing import Any

from app.db.models import TimetableSession

try:
    import schedaro_engine
except ImportError:  # pragma: no cover - exercised by the readiness check before image build
    schedaro_engine = None


class SchedulingEngineUnavailable(RuntimeError):
    pass


def engine_available() -> bool:
    return schedaro_engine is not None


def _session_payload(session: TimetableSession) -> dict[str, Any]:
    return {
        "id": session.id,
        "academic_term_id": session.academic_term_id,
        "class_group_id": session.class_group_id,
        "day": session.day_of_week,
        "start_minute": session.start_minute,
        "end_minute": session.end_minute,
        "teacher_id": session.teacher_id,
        "room_id": session.room_id,
    }


def _candidate_payload(candidate: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": candidate["id"],
        "academic_term_id": candidate["academic_term_id"],
        "class_group_id": candidate["class_group_id"],
        "day": candidate["day"],
        "start_minute": candidate["start_minute"],
        "end_minute": candidate["end_minute"],
        "teacher_id": candidate["teacher_id"],
        "room_id": candidate["room_id"],
    }


def validate_candidate(candidate: dict[str, Any], existing: Iterable[TimetableSession]) -> list[dict[str, Any]]:
    if schedaro_engine is None:
        raise SchedulingEngineUnavailable("The compiled schedaro_engine extension is unavailable")
    payload = {"candidate": _candidate_payload(candidate), "existing": [_session_payload(session) for session in existing]}
    result = json.loads(schedaro_engine.validate_schedule(json.dumps(payload)))
    return result.get("conflicts", [])
