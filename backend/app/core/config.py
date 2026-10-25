from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url


class Settings(BaseSettings):
    app_name: str = "Schedaro"
    app_env: str = "development"
    database_url: str
    platform_database_name: str = "schedaro_platform"
    auth_cookie_name: str = "schedaro_session"
    auth_cookie_secure: bool = False
    auth_session_hours: int = 8
    allowed_cors_origins: str = "http://localhost:5174"

    model_config = SettingsConfigDict(case_sensitive=False, extra="ignore")

    @property
    def database_name(self) -> str:
        return make_url(self.database_url).database or "schedaro_db"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
