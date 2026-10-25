from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field

WorkflowStatus = Literal["draft", "submitted", "changes_requested", "rejected", "approved", "published", "superseded", "archived"]

class TimetableVersionRead(BaseModel):
    id: str
    institution_id: str
    academic_term_id: str
    class_group_id: str
    version_number: int
    status: str
    session_snapshot: list[dict]
    creator_user_id: str
    last_editor_user_id: str
    submitted_by_user_id: str | None = None
    published_by_user_id: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    submitted_at: datetime | None = None
    published_at: datetime | None = None
    revision: int

class TimetableVersionCreate(BaseModel):
    base_version_id: str | None = None

class TimetableVersionUpdate(BaseModel):
    session_snapshot: list[dict] = Field(min_length=0)
    revision: int = Field(ge=1)

class WorkflowDecision(BaseModel):
    decision: Literal["approve", "request_changes", "reject"]
    reason: str | None = Field(default=None, max_length=2000)

class WorkflowDashboardRead(BaseModel):
    role: str
    institution_id: str
    draft_count: int
    submitted_count: int
    changes_requested_count: int
    approved_count: int
    published_count: int
    authorized_class_group_ids: list[str]
