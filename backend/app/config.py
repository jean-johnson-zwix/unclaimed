from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    llm_base_url: str = ""
    llm_api_key: str = ""
    llm_model: str = ""
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = ""
    graph_backend: str = "networkx"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
