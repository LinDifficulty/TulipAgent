"""LLM 工厂模块 - 支持多种 LLM 提供商"""
from typing import Protocol, Any
from langchain_core.language_models import BaseChatModel
from ..config import get_settings


class LLMFactory:
    """LLM 工厂类，根据配置创建不同的 LLM 实例"""

    _providers: dict[str, callable] = {}

    @classmethod
    def register(cls, provider: str):
        """注册 LLM 提供商的装饰器"""
        def decorator(factory_func):
            cls._providers[provider] = factory_func
            return factory_func
        return decorator

    @classmethod
    def create(cls, provider: str = None, **kwargs) -> BaseChatModel:
        """创建 LLM 实例

        Args:
            provider: 提供商名称，如果为 None 则使用配置中的默认值
            **kwargs: 额外参数，会覆盖配置中的默认值

        Returns:
            BaseChatModel: LLM 实例
        """
        settings = get_settings()
        provider = provider or settings.LLM_PROVIDER

        if provider not in cls._providers:
            raise ValueError(
                f"不支持的 LLM 提供商: {provider}，"
                f"可用的提供商: {list(cls._providers.keys())}"
            )

        return cls._providers[provider](settings, **kwargs)

    @classmethod
    def get_available_providers(cls) -> list[str]:
        """获取所有可用的提供商列表"""
        return list(cls._providers.keys())


@LLMFactory.register("openai")
def create_openai_llm(settings, **kwargs) -> BaseChatModel:
    """创建 OpenAI LLM 实例"""
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        model=kwargs.get("model", settings.LLM_MODEL),
        temperature=kwargs.get("temperature", settings.LLM_TEMPERATURE),
        max_tokens=kwargs.get("max_tokens", settings.LLM_MAX_TOKENS),
        openai_api_key=kwargs.get("api_key", settings.OPENAI_API_KEY),
        openai_api_base=kwargs.get("base_url", settings.OPENAI_BASE_URL),
    )


@LLMFactory.register("deepseek")
def create_deepseek_llm(settings, **kwargs) -> BaseChatModel:
    """创建 DeepSeek LLM 实例

    DeepSeek 使用 OpenAI 兼容的 API 格式
    """
    from langchain_openai import ChatOpenAI

    api_key = kwargs.get("api_key", settings.DEEPSEEK_API_KEY)
    base_url = kwargs.get("base_url", settings.DEEPSEEK_BASE_URL)
    model = kwargs.get("model", settings.DEEPSEEK_MODEL)

    if not api_key:
        raise ValueError(
            "DeepSeek API Key 未配置，请在 .env 文件中设置 DEEPSEEK_API_KEY"
        )

    return ChatOpenAI(
        model=model,
        temperature=kwargs.get("temperature", settings.LLM_TEMPERATURE),
        max_tokens=kwargs.get("max_tokens", settings.LLM_MAX_TOKENS),
        openai_api_key=api_key,
        openai_api_base=base_url,
    )


@LLMFactory.register("ollama")
def create_ollama_llm(settings, **kwargs) -> BaseChatModel:
    """创建 Ollama 本地 LLM 实例"""
    from langchain_community.chat_models import ChatOllama

    return ChatOllama(
        model=kwargs.get("model", settings.OLLAMA_MODEL),
        base_url=kwargs.get("base_url", settings.OLLAMA_BASE_URL),
        temperature=kwargs.get("temperature", settings.LLM_TEMPERATURE),
    )


# 便捷函数
def get_llm(provider: str = None, **kwargs) -> BaseChatModel:
    """获取 LLM 实例的便捷函数

    Args:
        provider: 提供商名称 (openai / deepseek / ollama)
        **kwargs: 额外参数

    Returns:
        BaseChatModel: LLM 实例
    """
    return LLMFactory.create(provider, **kwargs)


def get_llm_info() -> dict:
    """获取当前 LLM 配置信息"""
    settings = get_settings()
    provider = settings.LLM_PROVIDER

    info = {
        "provider": provider,
        "available_providers": LLMFactory.get_available_providers(),
    }

    if provider == "openai":
        info.update({
            "model": settings.LLM_MODEL,
            "base_url": settings.OPENAI_BASE_URL,
        })
    elif provider == "deepseek":
        info.update({
            "model": settings.DEEPSEEK_MODEL,
            "base_url": settings.DEEPSEEK_BASE_URL,
        })
    elif provider == "ollama":
        info.update({
            "model": settings.OLLAMA_MODEL,
            "base_url": settings.OLLAMA_BASE_URL,
        })

    return info
