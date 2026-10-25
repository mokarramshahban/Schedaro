from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class PlatformBase(DeclarativeBase):
    pass


class PlatformInstitution(PlatformBase):
    __tablename__ = "platform_institutions"
    __table_args__ = (
        UniqueConstraint("stable_key", name="uq_platform_institution_stable_key"),
        Index("ix_platform_institution_status", "status"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    stable_key: Mapped[str] = mapped_column(String(120), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    short_name: Mapped[str | None] = mapped_column(String(32))
    database_name: Mapped[str] = mapped_column(String(63), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="ready", server_default="ready")
    schema_version: Mapped[str | None] = mapped_column(String(64))
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class PlatformUser(PlatformBase):
    __tablename__ = "platform_users"
    __table_args__ = (UniqueConstraint("email", name="uq_platform_user_email"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(180), nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="platform_owner", server_default="platform_owner")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PlatformMembership(PlatformBase):
    __tablename__ = "platform_memberships"
    __table_args__ = (UniqueConstraint("user_id", "institution_id", name="uq_platform_membership_user_institution"), Index("ix_platform_membership_user", "user_id"))

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    institution_id: Mapped[str] = mapped_column(String(36), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="institution_viewer", server_default="institution_viewer")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class PlatformSession(PlatformBase):
    __tablename__ = "platform_sessions"
    __table_args__ = (Index("ix_platform_session_expires_at", "expires_at"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class PlatformAuditEvent(PlatformBase):
    __tablename__ = "platform_audit_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    actor_user_id: Mapped[str | None] = mapped_column(String(36), index=True)
    event_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    institution_id: Mapped[str | None] = mapped_column(String(36), index=True)
    metadata_json: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class PlatformSchemaVersion(PlatformBase):
    __tablename__ = "platform_schema_versions"

    version: Mapped[str] = mapped_column(String(64), primary_key=True)
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
