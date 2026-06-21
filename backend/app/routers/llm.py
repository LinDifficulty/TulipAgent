"""LLM 配置 API 路由"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from ..agent.llm_factory import get_llm, get_llm_info, LLMFactory
from ..agent.graph import reset_agent_graph, get_agent_graph

router = APIRouter(prefix="/api/llm", tags=["llm"])


class LLMConfigResponse(BaseModel):
    """LLM 配置响应"""
    provider: str
    available_providers: list[str]
    model: Optional[str] = None
    base_url: Optional[str] = None


class SwitchProviderRequest(BaseModel):
    """切换提供商请求"""
    provider: str
    model: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None


class TestLLMResponse(BaseModel):
    """测试 LLM 响应"""
    success: bool
    message: str
    provider: str
    model: str


@router.get("/config", response_model=LLMConfigResponse)
async def get_llm_config():
    """获取当前 LLM 配置"""
    info = get_llm_info()
    return LLMConfigResponse(**info)


@router.get("/providers")
async def list_providers():
    """获取所有可用的 LLM 提供商"""
    return {
        "providers": LLMFactory.get_available_providers(),
        "descriptions": {
            "openai": "OpenAI API (GPT-4, GPT-3.5 等)",
            "deepseek": "DeepSeek API (DeepSeek-Chat, DeepSeek-Coder 等)",
            "ollama": "Ollama 本地模型 (Qwen, Llama 等)",
        },
    }


@router.post("/test", response_model=TestLLMResponse)
async def test_llm_connection():
    """测试当前 LLM 连接"""
    try:
        llm = get_llm()
        info = get_llm_info()

        # 发送测试消息
        from langchain_core.messages import HumanMessage
        response = await llm.ainvoke([HumanMessage(content="你好，请回复'连接成功'")])

        return TestLLMResponse(
            success=True,
            message=response.content[:100],
            provider=info["provider"],
            model=info.get("model", "unknown"),
        )
    except Exception as e:
        return TestLLMResponse(
            success=False,
            message=str(e),
            provider=get_llm_info()["provider"],
            model=get_llm_info().get("model", "unknown"),
        )


@router.post("/reset")
async def reset_llm():
    """重置 LLM 配置（重新加载）"""
    reset_agent_graph()
    return {"status": "ok", "message": "LLM 配置已重置"}
