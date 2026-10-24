

def test_working_day_request_accepts_only_supported_five_or_six_day_weeks():
    from pydantic import ValidationError
    from app.schemas import GenerateTimetableRequest

    base = {"institution_id": "i", "academic_term_id": "t", "class_group_ids": ["g"], "selected_requirement_ids": ["r"]}
    assert len(GenerateTimetableRequest(**base, working_days=["monday", "tuesday", "wednesday", "thursday", "friday"]).working_days) == 5
    assert len(GenerateTimetableRequest(**base, working_days=["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]).working_days) == 6
    try:
        GenerateTimetableRequest(**base, working_days=["monday", "tuesday"])
    except ValidationError:
        pass
    else:
        raise AssertionError("partial working weeks must be rejected")
