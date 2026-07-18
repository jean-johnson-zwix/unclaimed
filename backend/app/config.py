from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    graph_backend: str = "networkx"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
