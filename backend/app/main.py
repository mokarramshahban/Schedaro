from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.api.academic import router as academic_router
from app.api.timetable import router as timetable_router
from app.api.generation import router as generation_router
from app.api.print_layout import router as print_layout_router
from app.api.auth import router as auth_router
from app.api.platform import router as platform_router
from app.api.invitations import router as invitations_router
from app.db.platform import ensure_platform_database, ensure_platform_schema
from app.db.session import check_database_connection
from app.services.scheduling import engine_available

settings = get_settings()
app = FastAPI(title="Schedaro API", version="0.1.0", description="Smart Academic Timetable Builder API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(academic_router)
app.include_router(timetable_router)
app.include_router(generation_router)
app.include_router(print_layout_router)
app.include_router(auth_router)
app.include_router(platform_router)
app.include_router(invitations_router)


@app.on_event("startup")
def initialize_platform_schema() -> None:
    if ensure_platform_database():
        ensure_platform_schema()


@app.get("/health/live")
def live() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready")
def ready() -> JSONResponse:
    database_ready = check_database_connection()
    payload = {"status": "ready" if database_ready else "not_ready", "database": "connected" if database_ready else "unavailable"}
    return JSONResponse(status_code=200 if database_ready else status.HTTP_503_SERVICE_UNAVAILABLE, content=payload)


@app.get("/api/v1/status")
def service_status() -> dict[str, str | bool]:
    database_ready = check_database_connection()
    return {"application": settings.app_name, "environment": settings.app_env, "service": "api", "database_available": database_ready, "rust_engine_available": engine_available()}
