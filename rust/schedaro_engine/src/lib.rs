use pyo3::exceptions::PyValueError;
use pyo3::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
struct SessionInput {
    id: String,
    academic_term_id: String,
    class_group_id: String,
    day: String,
    start_minute: i32,
    end_minute: i32,
    teacher_id: String,
    room_id: String,
}

#[derive(Debug, Deserialize)]
struct ValidationInput {
    candidate: SessionInput,
    existing: Vec<SessionInput>,
}

#[derive(Debug, Serialize)]
struct Conflict {
    kind: String,
    conflicting_session_id: Option<String>,
    resource_id: Option<String>,
    start_minute: i32,
    end_minute: i32,
    message: String,
}

#[derive(Debug, Serialize)]
struct ValidationOutput {
    conflicts: Vec<Conflict>,
}

fn overlaps(candidate: &SessionInput, existing: &SessionInput) -> bool {
    candidate.academic_term_id == existing.academic_term_id
        && candidate.day == existing.day
        && candidate.start_minute < existing.end_minute
        && existing.start_minute < candidate.end_minute
}

fn validate(input: ValidationInput) -> ValidationOutput {
    let candidate = &input.candidate;
    let mut conflicts = Vec::new();

    if candidate.start_minute < 0 || candidate.end_minute > 1440 || candidate.start_minute >= candidate.end_minute {
        conflicts.push(Conflict {
            kind: "invalid_interval".to_string(),
            conflicting_session_id: None,
            resource_id: None,
            start_minute: candidate.start_minute,
            end_minute: candidate.end_minute,
            message: "Session start and end must form a valid half-open interval within one day.".to_string(),
        });
        return ValidationOutput { conflicts };
    }

    for existing in input.existing.iter().filter(|session| session.id != candidate.id && overlaps(candidate, session)) {
        if candidate.class_group_id == existing.class_group_id {
            conflicts.push(Conflict {
                kind: "class_group".to_string(),
                conflicting_session_id: Some(existing.id.clone()),
                resource_id: Some(candidate.class_group_id.clone()),
                start_minute: existing.start_minute,
                end_minute: existing.end_minute,
                message: format!("Class group {} already has a session during this interval.", candidate.class_group_id),
            });
        }
        if candidate.teacher_id == existing.teacher_id {
            conflicts.push(Conflict {
                kind: "teacher".to_string(),
                conflicting_session_id: Some(existing.id.clone()),
                resource_id: Some(candidate.teacher_id.clone()),
                start_minute: existing.start_minute,
                end_minute: existing.end_minute,
                message: format!("Teacher {} is already assigned during this interval.", candidate.teacher_id),
            });
        }
        if candidate.room_id == existing.room_id {
            conflicts.push(Conflict {
                kind: "room".to_string(),
                conflicting_session_id: Some(existing.id.clone()),
                resource_id: Some(candidate.room_id.clone()),
                start_minute: existing.start_minute,
                end_minute: existing.end_minute,
                message: format!("Room {} is already booked during this interval.", candidate.room_id),
            });
        }
    }
    ValidationOutput { conflicts }
}

#[pyfunction]
fn validate_schedule(payload: &str) -> PyResult<String> {
    let input: ValidationInput = serde_json::from_str(payload)
        .map_err(|error| PyValueError::new_err(format!("invalid scheduling payload: {error}")))?;
    serde_json::to_string(&validate(input))
        .map_err(|error| PyValueError::new_err(format!("could not serialize scheduling result: {error}")))
}

#[pymodule]
fn schedaro_engine(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(validate_schedule, m)?)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{validate, SessionInput, ValidationInput};

    fn session(id: &str, term: &str, group: &str, day: &str, start: i32, end: i32, teacher: &str, room: &str) -> SessionInput {
        SessionInput {
            id: id.to_string(),
            academic_term_id: term.to_string(),
            class_group_id: group.to_string(),
            day: day.to_string(),
            start_minute: start,
            end_minute: end,
            teacher_id: teacher.to_string(),
            room_id: room.to_string(),
        }
    }

    #[test]
    fn adjacent_sessions_do_not_conflict() {
        let candidate = session("new", "term-a", "group-a", "monday", 600, 660, "teacher-a", "room-a");
        let existing = session("old", "term-a", "group-a", "monday", 540, 600, "teacher-a", "room-a");
        assert!(validate(ValidationInput { candidate, existing: vec![existing] }).conflicts.is_empty());
    }

    #[test]
    fn partial_overlap_reports_all_shared_resources() {
        let candidate = session("new", "term-a", "group-a", "monday", 600, 690, "teacher-a", "room-a");
        let existing = session("old", "term-a", "group-a", "monday", 630, 720, "teacher-a", "room-a");
        let result = validate(ValidationInput { candidate, existing: vec![existing] });
        assert_eq!(result.conflicts.len(), 3);
    }

    #[test]
    fn containment_and_identical_intervals_overlap() {
        let candidate = session("new", "term-a", "group-a", "monday", 570, 750, "teacher-a", "room-a");
        let existing = session("old", "term-a", "group-a", "monday", 600, 660, "teacher-a", "room-a");
        assert_eq!(validate(ValidationInput { candidate, existing: vec![existing] }).conflicts.len(), 3);
    }

    #[test]
    fn different_days_and_terms_do_not_conflict() {
        let candidate = session("new", "term-a", "group-a", "monday", 600, 660, "teacher-a", "room-a");
        let other_day = session("day", "term-a", "group-a", "tuesday", 600, 660, "teacher-a", "room-a");
        let other_term = session("term", "term-b", "group-a", "monday", 600, 660, "teacher-a", "room-a");
        assert!(validate(ValidationInput { candidate, existing: vec![other_day, other_term] }).conflicts.is_empty());
    }

    #[test]
    fn invalid_interval_is_rejected() {
        let candidate = session("new", "term-a", "group-a", "monday", 720, 700, "teacher-a", "room-a");
        let result = validate(ValidationInput { candidate, existing: vec![] });
        assert_eq!(result.conflicts[0].kind, "invalid_interval");
    }

    #[test]
    fn self_is_excluded_for_updates() {
        let candidate = session("same", "term-a", "group-a", "monday", 600, 660, "teacher-a", "room-a");
        let result = validate(ValidationInput { candidate: candidate.clone(), existing: vec![candidate] });
        assert!(result.conflicts.is_empty());
    }

    #[test]
    fn variable_length_lab_is_validated() {
        let candidate = session("lab", "term-a", "group-a", "friday", 540, 660, "teacher-a", "lab-a");
        let existing = session("other", "term-a", "group-b", "friday", 600, 720, "teacher-a", "room-b");
        let result = validate(ValidationInput { candidate, existing: vec![existing] });
        assert_eq!(result.conflicts[0].kind, "teacher");
    }
}
