from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import ClassGroup, Department, Semester
from app.db.platform import tenant_session
from app.db.platform_models import PlatformInstitution, PlatformMembership, PlatformRoleAssignment, PlatformUser
from app.services.platform import trusted_institution

ROLE_ALIASES = {
    "institution_admin": "college_administrator",
    "college_admin": "college_administrator",
    "institution_viewer": "faculty",
    "institution_editor": "academic_coordinator",
}
ROLES = {"college_administrator", "director", "dean", "registrar", "hod", "academic_coordinator", "class_in_charge", "faculty", "student"}
PERMISSIONS = {
    "users.view": "View users within the authorized scope",
    "users.invite": "Invite users within the authorized scope",
    "roles.assign": "Assign explicitly delegable roles",
    "roles.revoke": "Revoke subordinate role assignments",
    "institution.view": "View institution academic structure",
    "institution.manage": "Manage institution configuration",
    "academics.view": "View authorized academic records",
    "academics.manage": "Manage authorized academic records",
    "timetable.view": "View authorized timetable records",
    "timetable.edit": "Edit authorized timetable drafts",
    "generation.use": "Use timetable generation in authorized scope",
}
ROLE_PERMISSIONS = {
    "college_administrator": set(PERMISSIONS),
    "director": {"users.view", "users.invite", "roles.assign", "roles.revoke", "institution.view", "institution.manage", "academics.view", "academics.manage", "timetable.view", "timetable.edit", "generation.use"},
    "registrar": {"users.view", "institution.view", "academics.view", "academics.manage", "timetable.view", "generation.use"},
    "dean": {"users.view", "users.invite", "roles.assign", "roles.revoke", "institution.view", "academics.view", "academics.manage", "timetable.view", "generation.use"},
    "hod": {"users.view", "users.invite", "roles.assign", "roles.revoke", "institution.view", "academics.view", "academics.manage", "timetable.view", "timetable.edit", "generation.use"},
    "academic_coordinator": {"users.view", "institution.view", "academics.view", "academics.manage", "timetable.view", "timetable.edit", "generation.use"},
    "class_in_charge": {"users.view", "institution.view", "academics.view", "timetable.view", "timetable.edit", "generation.use"},
    "faculty": {"institution.view", "academics.view", "timetable.view"},
    "student": {"institution.view", "timetable.view"},
}
DELEGABLE = {
    "college_administrator": ROLES - {"college_administrator"},
    "director": {"dean", "registrar", "hod", "academic_coordinator", "class_in_charge", "faculty", "student"},
    "dean": {"hod", "academic_coordinator", "class_in_charge", "faculty", "student"},
    "hod": {"academic_coordinator", "class_in_charge", "faculty", "student"},
}
SCOPE_TYPES = {"institution", "department", "semester", "section"}


def canonical_role(role: str) -> str:
    return ROLE_ALIASES.get(role, role)


def assignment_permissions(assignment: PlatformRoleAssignment) -> set[str]:
    return ROLE_PERMISSIONS.get(canonical_role(assignment.role), set())


def active_assignments(db: Session, user_id: str, institution_id: str | None = None) -> list[PlatformRoleAssignment]:
    query = select(PlatformRoleAssignment).where(PlatformRoleAssignment.user_id == user_id, PlatformRoleAssignment.status == "active")
    if institution_id:
        query = query.where(PlatformRoleAssignment.institution_id == institution_id)
    return list(db.scalars(query.order_by(PlatformRoleAssignment.created_at)).all())


def assignment_in_scope(db: Session, assignment: PlatformRoleAssignment, institution_id: str, scope_type: str, scope_id: str | None) -> bool:
    if assignment.institution_id != institution_id or assignment.status != "active":
        return False
    if assignment.scope_type == "institution":
        return True
    if assignment.scope_type == scope_type and assignment.scope_id == scope_id:
        return True
    return False


def validate_scope(platform_db: Session, institution_id: str, scope_type: str, scope_id: str | None) -> str | None:
    if scope_type not in SCOPE_TYPES:
        raise ValueError("Unsupported organizational scope.")
    if scope_type == "institution":
        if scope_id not in (None, institution_id): raise ValueError("Institution scope must match the selected institution.")
        return None
    if not scope_id: raise ValueError("A scope identifier is required.")
    institution = trusted_institution(platform_db, institution_id)
    model = {"department": Department, "semester": Semester, "section": ClassGroup}[scope_type]
    with tenant_session(institution.database_name) as tenant_db:
        record = tenant_db.get(model, scope_id)
        if record is None: raise ValueError("The organizational scope does not exist in this institution.")
        if scope_type == "department" and record.institution_id != institution_id: raise ValueError("The scope belongs to another institution.")
        if scope_type == "semester":
            department = tenant_db.get(Department, record.department_id)
            if department is None or department.institution_id != institution_id: raise ValueError("The scope belongs to another institution.")
        if scope_type == "section":
            department = tenant_db.get(Department, record.department_id)
            if department is None or department.institution_id != institution_id: raise ValueError("The scope belongs to another institution.")
        return getattr(record, "name", None) or getattr(record, "label", None) or getattr(record, "section_name", None)


def scope_label(platform_db: Session, institution_id: str, scope_type: str, scope_id: str | None) -> str | None:
    if scope_type == "institution" or not scope_id:
        return None
    institution = trusted_institution(platform_db, institution_id)
    with tenant_session(institution.database_name) as tenant_db:
        if scope_type == "department":
            record = tenant_db.get(Department, scope_id)
            return (record.code or record.name) if record else None
        if scope_type == "semester":
            record = tenant_db.get(Semester, scope_id)
            department = tenant_db.get(Department, record.department_id) if record else None
            return f"{department.code or department.name} · {record.label}" if record and department else None
        if scope_type == "section":
            record = tenant_db.get(ClassGroup, scope_id)
            department = tenant_db.get(Department, record.department_id) if record else None
            semester = tenant_db.get(Semester, record.semester_id) if record else None
            return f"{department.code or department.name} · {semester.label} · {record.section_name}" if record and department and semester else None
    return None


def actor_can(db: Session, actor: PlatformUser, institution_id: str, permission: str, target_role: str | None = None, scope_type: str = "institution", scope_id: str | None = None) -> bool:
    if actor.role == "platform_owner": return True
    membership = db.scalar(select(PlatformMembership).where(PlatformMembership.user_id == actor.id, PlatformMembership.institution_id == institution_id, PlatformMembership.active.is_(True)))
    if membership is None: return False
    assignments = active_assignments(db, actor.id, institution_id)
    if not assignments and canonical_role(membership.role) == "college_administrator":
        return permission in ROLE_PERMISSIONS["college_administrator"]
    for assignment in assignments:
        if permission in assignment_permissions(assignment) and assignment_in_scope(db, assignment, institution_id, scope_type, scope_id):
            if target_role and canonical_role(target_role) not in DELEGABLE.get(canonical_role(assignment.role), set()): return False
            return True
    return False
