from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://spatial:spatial@localhost:5432/spatial_explorer"
    ors_api_key: str = ""  # OpenRouteService key; empty = use buffer-ring fallback
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    class Config:
        env_file = ".env"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
