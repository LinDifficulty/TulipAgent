"""LangGraph Agent 工作流"""
import logging
from typing import Annotated, Sequence, TypedDict
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode

from ..config import get_settings
from ..database import async_session_factory
from ..models.memory import Memory
from .tools import get_all_tools
from .prompts import get_system_prompt
from .llm_factory import get_llm

logger = logging.getLogger(__name__)


# Agent 状态
class AgentState(TypedDict):
    """Agent 状态定义"""
    messages: Annotated[Sequence[BaseMessage], lambda x, y: x + y]
    user_id: str
    account_id: str
    group_id: int | None


def create_agent_graph():
    """创建 Agent 图"""
    # 获取工具
    tools = get_all_tools()

    # 使用工厂创建 LLM 并绑定工具
    llm = get_llm()
    llm_with_tools = llm.bind_tools(tools)

    # 工具节点
    tool_node = ToolNode(tools)

    # 定义节点函数
    async def agent_node(state: AgentState):
        """Agent 节点 - 调用 LLM"""
        messages = state["messages"]
        account_id = state.get("account_id", state.get("user_id", ""))
        group_id = state.get("group_id")

        # 获取用户信息（使用 account_id）
        settings = get_settings()
        user_info = settings.USERS.get(account_id, {})
        user_name = user_info.get("name", "用户")

        # 获取长期记忆
        memory_context = ""
        try:
            async with async_session_factory() as session:
                from sqlalchemy import select, or_
                # 将 state 中的字符串 account_id 转为 int
                account_id_int = int(account_id) if account_id and account_id.isdigit() else None
                stmt = select(Memory)
                if group_id is not None:
                    stmt = stmt.where(or_(
                        Memory.group_id == group_id,
                        Memory.account_id == account_id_int,
                    ))
                elif account_id_int is not None:
                    stmt = stmt.where(Memory.account_id == account_id_int)
                stmt = stmt.order_by(Memory.created_at.desc()).limit(20)
                result = await session.execute(stmt)
                memories = result.scalars().all()

                if memories:
                    category_labels = {
                        "user_fact": "用户偏好/事实",
                        "important_date": "重要日期",
                        "decision": "决定",
                        "habit": "习惯",
                    }
                    lines = ["## 你记住的重要信息"]
                    for m in memories:
                        label = category_labels.get(m.category, "其他")
                        lines.append(f"- [{label}] {m.content}")
                    memory_context = "\n".join(lines)
        except Exception:
            pass  # 记忆加载失败不影响对话

        # 构建系统提示
        system_prompt = get_system_prompt(
            user_info=f"当前用户：{user_name}",
            memory_context=memory_context,
        )

        # 添加系统消息
        if not messages or not isinstance(messages[0], SystemMessage):
            messages = [SystemMessage(content=system_prompt)] + list(messages)

        # 调用 LLM
        response = await llm_with_tools.ainvoke(messages)
        # 诊断日志：记录 LLM 是否返回了工具调用
        has_tool_calls = bool(getattr(response, "tool_calls", None))
        if has_tool_calls:
            tool_names = [tc["name"] for tc in response.tool_calls]
            logger.info(f"[Agent] LLM 请求调用工具: {tool_names}, args: {[tc.get('args', {}) for tc in response.tool_calls]}")
        else:
            logger.info(f"[Agent] LLM 直接回复（未调用任何工具），回复前50字: {str(response.content)[:50]}")
        return {"messages": [response]}

    def should_continue(state: AgentState) -> str:
        """判断是否需要继续调用工具"""
        messages = state["messages"]
        last_message = messages[-1]

        # 如果有工具调用，继续
        has_tool_calls = bool(getattr(last_message, "tool_calls", None))
        if has_tool_calls:
            logger.info(f"[Graph] should_continue → tools (调用 {[tc['name'] for tc in last_message.tool_calls]})")
            return "tools"
        # 否则结束
        logger.info(f"[Graph] should_continue → END（无工具调用，对话结束）")
        return END

    # 构建图
    workflow = StateGraph(AgentState)

    # 添加节点
    workflow.add_node("agent", agent_node)
    workflow.add_node("tools", tool_node)

    # 设置入口
    workflow.set_entry_point("agent")

    # 添加边
    workflow.add_conditional_edges(
        "agent",
        should_continue,
        {
            "tools": "tools",
            END: END,
        }
    )
    workflow.add_edge("tools", "agent")

    # 编译图
    graph = workflow.compile()
    return graph


# 全局 Agent 实例
_agent_graph = None


def get_agent_graph():
    """获取 Agent 图单例"""
    global _agent_graph
    if _agent_graph is None:
        _agent_graph = create_agent_graph()
    return _agent_graph


def reset_agent_graph():
    """重置 Agent 图（用于重新加载配置）"""
    global _agent_graph
    _agent_graph = None
