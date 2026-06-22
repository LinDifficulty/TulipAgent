"""应用配置"""
from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """应用设置"""

    # 应用基础配置
    APP_NAME: str = "TulipAgent"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # CORS 配置（多个来源用逗号分隔）
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # 数据库配置
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/sqlite/tulipagent.db"
    CHROMA_PERSIST_DIR: str = "./data/chroma"
    FILES_DIR: str = "./data/files"

    # LLM 提供商配置 (openai / deepseek / ollama)
    LLM_PROVIDER: str = "deepseek"

    # OpenAI 兼容 API 配置 (适用于 OpenAI / DeepSeek / 其他兼容 API)
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    LLM_MODEL: str = "gpt-4o-mini"

    # DeepSeek API 配置
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"
    DEEPSEEK_MODEL: str = "deepseek-chat"

    # 本地模型配置 (Ollama)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5:7b"

    # LLM 通用配置
    LLM_TEMPERATURE: float = 0.7
    LLM_MAX_TOKENS: int = 2000

    # 向量数据库配置
    CHROMA_COLLECTION_NAME: str = "tulipagent_memory"

    # 定时任务配置
    SCHEDULER_TIMEZONE: str = "Asia/Shanghai"

    # 快递100 API 配置
    KUAIDI100_CUSTOMER: str = ""
    KUAIDI100_KEY: str = ""

    # 用户配置
    USERS: dict = {
        "user1": {"name": "主人"},
        "user2": {"name": "宝贝"},
    }

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """获取配置单例"""
    return Settings()


# 确保数据目录存在
def ensure_data_dirs():
    """创建必要的数据目录"""
    settings = get_settings()
    Path(settings.CHROMA_PERSIST_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.FILES_DIR).mkdir(parents=True, exist_ok=True)
    Path("./data/sqlite").mkdir(parents=True, exist_ok=True)
