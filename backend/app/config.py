from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    llm_base_url: str = ""  # OpenAI-compatible endpoint (Groq, Together, Ollama, etc.)
    llm_api_key: str = ""
    llm_model: str = ""  # e.g. "llama-3.1-70b-versatile", "gemini-2.0-flash", etc.
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = ""
    graph_backend: str = "networkx"  # "networkx" or "neo4j"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
