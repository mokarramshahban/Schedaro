from __future__ import annotations

from dataclasses import dataclass
from time import monotonic
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import Room, SchedulingRequirement, TeacherAvailability, TimetableSession, new_id

try:
    from ortools.sat.python import cp_model
except ImportError:  # pragma: no cover - exercised by readiness when dependency is missing
    cp_model = None

DAYS = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday")


class GeneratorUnavailable(RuntimeError):
    pass


@dataclass(frozen=True)
class GenerationConfig:
    working_days: list[str]
    daily_start: int
    daily_end: int
    quantum: int
    time_limit_seconds: int
    preference: str


def clock_minutes(value: str) -> int:
    hours, minutes = (int(part) for part in value.split(":"))
    return hours * 60 + minutes


def clock_value(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def overlaps(day: str, start: int, end: int, other: TimetableSession) -> bool:
    return day == other.day_of_week and start < other.end_minute and other.start_minute < end


def compatible_room(room: Room, room_type: str) -> bool:
    if room_type == "any":
        return True
    if room_type == "tutorial":
        return room.room_type in {"tutorial", "classroom"}
    return room.room_type == room_type


def teacher_permitted(teacher_id: str, day: str, start: int, end: int, availability: list[TeacherAvailability]) -> bool:
    rows = [row for row in availability if row.teacher_id == teacher_id and row.day_of_week == day]
    if not rows:
        return True
    unavailable = [row for row in rows if not row.available]
    if any(start < row.end_minute and row.start_minute < end for row in unavailable):
        return False
    permitted = [row for row in rows if row.available]
    return not permitted or any(row.start_minute <= start and end <= row.end_minute for row in permitted)


def requirement_summary(requirement: SchedulingRequirement, sessions: list[TimetableSession]) -> dict[str, Any]:
    related = [session for session in sessions if session.class_group_id == requirement.class_group_id and session.subject_id == requirement.subject_id and session.session_type == requirement.session_type]
    matching_ids: set[str] = set()
    mismatched_durations = 0
    mismatched_teachers = 0
    for session in related:
        duration = session.end_minute - session.start_minute
        if session.teacher_id == requirement.teacher_id and duration == requirement.duration_minutes:
            matching_ids.add(session.id)
        else:
            if duration != requirement.duration_minutes:
                mismatched_durations += 1
            if session.teacher_id != requirement.teacher_id:
                mismatched_teachers += 1
    scheduled = len(matching_ids)
    warning = None
    if mismatched_durations:
        warning = f"{mismatched_durations} existing {requirement.session_type} session(s) have a different duration; they are not counted."
    if mismatched_teachers:
        warning = (warning + " " if warning else "") + f"{mismatched_teachers} existing {requirement.session_type} session(s) use a different teacher; they are not counted."
    if scheduled > requirement.weekly_count:
        warning = (warning + " " if warning else "") + "Existing matching sessions exceed this requirement."
    return {"requirement_id": requirement.id, "subject_id": requirement.subject_id, "teacher_id": requirement.teacher_id, "session_type": requirement.session_type, "duration_minutes": requirement.duration_minutes, "room_type": requirement.room_type, "required_count": requirement.weekly_count, "scheduled_count": scheduled, "remaining_count": max(requirement.weekly_count - scheduled, 0), "duration_mismatch_count": mismatched_durations, "teacher_mismatch_count": mismatched_teachers, "warning": warning}


def _placement_conflicts_existing(placement: dict[str, Any], existing: list[TimetableSession]) -> bool:
    return any(
        overlaps(placement["day"], placement["start_minute"], placement["end_minute"], session)
        and placement["class_group_id"] == session.class_group_id
        for session in existing
    ) or any(
        overlaps(placement["day"], placement["start_minute"], placement["end_minute"], session)
        and placement["teacher_id"] == session.teacher_id
        for session in existing
    ) or any(
        overlaps(placement["day"], placement["start_minute"], placement["end_minute"], session)
        and placement["room_id"] == session.room_id
        for session in existing
    )


def _placement_conflicts(a: dict[str, Any], b: dict[str, Any]) -> bool:
    if a["day"] != b["day"] or not (a["start_minute"] < b["end_minute"] and b["start_minute"] < a["end_minute"]):
        return False
    return a["class_group_id"] == b["class_group_id"] or a["teacher_id"] == b["teacher_id"] or a["room_id"] == b["room_id"]


def generate_candidate(db: Session, requirements: list[SchedulingRequirement], existing: list[TimetableSession], availability: list[TeacherAvailability], rooms: list[Room], config: GenerationConfig) -> dict[str, Any]:
    if cp_model is None:
        raise GeneratorUnavailable("OR-Tools is unavailable in the backend image.")
    if not requirements:
        return {"status": "INFEASIBLE", "message": "No active scheduling requirements are configured for the selected class group(s).", "sessions": [], "objective_value": None, "solve_time_ms": 0}
    if config.daily_end <= config.daily_start:
        return {"status": "MODEL_INVALID", "message": "The daily end time must be later than the daily start time.", "sessions": [], "objective_value": None, "solve_time_ms": 0}

    model = cp_model.CpModel()
    choice_groups: list[list[tuple[Any, dict[str, Any]]]] = []
    for requirement in requirements:
        occurrences: list[tuple[Any, dict[str, Any]]] = []
        for occurrence in range(requirement.weekly_count):
            placements: list[dict[str, Any]] = []
            for day_index, day in enumerate(config.working_days):
                for start in range(config.daily_start, config.daily_end - requirement.duration_minutes + 1, config.quantum):
                    end = start + requirement.duration_minutes
                    if not teacher_permitted(requirement.teacher_id, day, start, end, availability):
                        continue
                    for room in rooms:
                        if not compatible_room(room, requirement.room_type):
                            continue
                        placement = {"id": new_id(), "class_group_id": requirement.class_group_id, "subject_id": requirement.subject_id, "teacher_id": requirement.teacher_id, "room_id": room.id, "session_type": requirement.session_type, "day": day, "day_index": day_index, "start_minute": start, "end_minute": end}
                        if not _placement_conflicts_existing(placement, existing):
                            placements.append(placement)
            if not placements:
                return {"status": "INFEASIBLE", "message": f"No permitted period and compatible room exists for requirement {requirement.subject_id} ({requirement.session_type}).", "sessions": [], "objective_value": None, "solve_time_ms": 0}
            variables = [(model.NewBoolVar(f"requirement_{requirement.id}_{occurrence}_{index}"), placement) for index, placement in enumerate(placements)]
            model.Add(sum(variable for variable, _ in variables) == 1)
            occurrences.extend(variables)
        choice_groups.append(occurrences)

    all_choices = [choice for group in choice_groups for choice in group]
    for left_index, (left_var, left) in enumerate(all_choices):
        for right_var, right in all_choices[left_index + 1:]:
            if _placement_conflicts(left, right):
                model.Add(left_var + right_var <= 1)

    objective_terms = []
    for variable, placement in all_choices:
        start_weight = placement["start_minute"] - config.daily_start
        day_weight = placement["day_index"] * 100 if config.preference == "earlier" else placement["day_index"] * 20
        objective_terms.append((day_weight + start_weight, variable))
    model.Minimize(sum(weight * variable for weight, variable in objective_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = config.time_limit_seconds
    solver.parameters.num_search_workers = 1
    started = monotonic()
    result = solver.Solve(model)
    elapsed = int((monotonic() - started) * 1000)
    status_name = solver.StatusName(result)
    if status_name not in {"OPTIMAL", "FEASIBLE"}:
        message = {"INFEASIBLE": "No timetable satisfies the active requirements, existing sessions, availability, and room constraints.", "MODEL_INVALID": "The automatic timetable model is invalid and could not be solved.", "UNKNOWN": "The solver time limit was reached without a usable timetable."}.get(status_name, f"Solver returned {status_name}.")
        return {"status": status_name if status_name in {"INFEASIBLE", "MODEL_INVALID", "UNKNOWN"} else "UNKNOWN", "message": message, "sessions": [], "objective_value": None, "solve_time_ms": elapsed}

    sessions = []
    for variable, placement in all_choices:
        if solver.Value(variable):
            sessions.append({key: placement[key] for key in ("id", "class_group_id", "subject_id", "teacher_id", "room_id", "session_type", "day", "start_minute", "end_minute")})
    return {"status": status_name, "message": "A valid unsaved timetable proposal was generated. Review it before approval.", "sessions": sessions, "objective_value": solver.ObjectiveValue(), "solve_time_ms": elapsed}
