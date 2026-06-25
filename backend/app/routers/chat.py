"""聊天 API 路由"""
import time
import uuid
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from pydantic import BaseModel
from langchain_core.messages import HumanMessage, AIMessage
from sqlalchemy import select, func, desc

from ..agent.graph import get_agent_graph
from ..agent.prompts import WELCOME_MESSAGE
from ..agent.context import current_account_id, current_group_id, current_is_admin
from ..models.account import Account
from ..models.conversation import Conversation
from ..database import async_session_factory
from ..auth import get_current_account

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatRequest(BaseModel):
    """聊天请求"""
    message: str
    session_id: str = None


class ChatResponse(BaseModel):
    """聊天响应"""
    response: str
    session_id: str
    tool_calls: list = []


class SessionStore:
    """带 TTL 过期和数量上限的会话存储，防止内存无限增长。

    - 每次访问会刷新该会话的最后活跃时间
    - 超过 TTL（默认 2 小时）未访问的会话会被清理
    - 超过最大数量（默认 100）时，淘汰最久未访问的会话
    """

    def __init__(self, max_sessions: int = 100, ttl_seconds: int = 7200):
        self._store: dict[str, list] = {}
        self._access_times: dict[str, float] = {}
        self._max_sessions = max_sessions
        self._ttl_seconds = ttl_seconds

    def _evict_expired(self):
        """清理过期会话"""
        now = time.monotonic()
        expired = [
            sid for sid, ts in self._access_times.items()
            if now - ts > self._ttl_seconds
        ]
        for sid in expired:
            self._store.pop(sid, None)
            self._access_times.pop(sid, None)

    def _evict_oldest(self):
        """淘汰最久未访问的会话（调用前应已确保有会话可淘汰）"""
        if not self._access_times:
            return
        oldest_sid = min(self._access_times, key=self._access_times.get)
        self._store.pop(oldest_sid, None)
        self._access_times.pop(oldest_sid, None)

    def get(self, session_id: str) -> list | None:
        """获取会话历史，不存在返回 None"""
        self._evict_expired()
        if session_id in self._store:
            self._access_times[session_id] = time.monotonic()
            return self._store[session_id]
        return None

    def create(self, session_id: str) -> list:
        """创建新会话并返回引用，超出上限时自动淘汰最旧会话"""
        self._evict_expired()
        while len(self._store) >= self._max_sessions:
            self._evict_oldest()
        self._store[session_id] = []
        self._access_times[session_id] = time.monotonic()
        return self._store[session_id]

    def update(self, session_id: str, messages: list):
        """更新会话历史"""
        self._store[session_id] = messages
        self._access_times[session_id] = time.monotonic()

    def delete(self, session_id: str) -> bool:
        """删除会话，返回是否存在"""
        existed = session_id in self._store
        self._store.pop(session_id, None)
        self._access_times.pop(session_id, None)
        return existed

    def list_ids(self) -> list[str]:
        """列出所有会话 ID"""
        self._evict_expired()
        return list(self._store.keys())


# 会话存储（最多 100 个，2 小时未访问自动过期）
sessions = SessionStore(max_sessions=100, ttl_seconds=7200)


@router.post("/send", response_model=ChatResponse)
async def send_message(
    request: ChatRequest,
    account: Account = Depends(get_current_account),
):
    """发送消息"""
    # 生成会话ID
    session_id = request.session_id or str(uuid.uuid4())

    # 获取或创建会话历史
    history = sessions.get(session_id)
    if history is None:
        history = sessions.create(session_id)

    # 添加用户消息
    history.append(HumanMessage(content=request.message))

    # 获取 Agent
    agent = get_agent_graph()

    # 设置上下文变量（工具通过 contextvars 获取账户信息）
    current_account_id.set(str(account.id))
    current_group_id.set(account.group_id)
    current_is_admin.set(account.role == "admin")

    # 调用 Agent（传递账户信息用于组过滤）
    result = await agent.ainvoke({
        "messages": history,
        "user_id": str(account.id),
        "account_id": str(account.id),
        "group_id": account.group_id,
    })

    # 提取响应
    response_message = result["messages"][-1]
    response_text = response_message.content

    # 提取工具调用
    tool_calls = []
    if hasattr(response_message, "tool_calls"):
        for tc in response_message.tool_calls:
            tool_calls.append({
                "name": tc["name"],
                "args": tc["args"],
            })

    # 更新会话历史
    sessions.update(session_id, result["messages"])

    # 持久化到数据库
    async with async_session_factory() as db:
        conv = Conversation(
            user_id=str(account.id),
            message=request.message,
            response=response_text,
            tool_calls=tool_calls if tool_calls else None,
            session_id=session_id,
        )
        db.add(conv)
        await db.commit()

    return ChatResponse(
        response=response_text,
        session_id=session_id,
        tool_calls=tool_calls,
    )


@router.get("/welcome")
async def get_welcome_message():
    """获取欢迎消息"""
    return {"message": WELCOME_MESSAGE}


@router.get("/sessions")
async def list_sessions(
    account: Account = Depends(get_current_account),
):
    """获取会话列表"""
    return {"sessions": sessions.list_ids()}


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    account: Account = Depends(get_current_account),
):
    """删除会话"""
    sessions.delete(session_id)
    return {"status": "ok"}


@router.get("/conversations")
async def list_conversations(
    account: Account = Depends(get_current_account),
):
    """获取用户的会话历史列表"""
    async with async_session_factory() as db:
        result = await db.execute(
            select(Conversation)
            .where(Conversation.user_id == str(account.id))
            .order_by(Conversation.created_at.desc())
        )
        all_convs = result.scalars().all()

    # 按 session_id 分组，取每个会话的预览信息
    sessions_map: dict[str, dict] = {}
    for conv in all_convs:
        if conv.session_id not in sessions_map:
            sessions_map[conv.session_id] = {
                "session_id": conv.session_id,
                "last_active": conv.created_at,
                "message_count": 0,
                "preview": conv.message,
                "started_at": conv.created_at,
            }
        sessions_map[conv.session_id]["message_count"] += 1
        # 由于按 created_at desc 排序，第一条记录是最新消息（已设为 preview），
        # 最后遍历到的是最早的消息，用于覆盖 started_at
        sessions_map[conv.session_id]["started_at"] = conv.created_at

    conversations = sorted(
        sessions_map.values(),
        key=lambda x: x["last_active"],
        reverse=True,
    )

    return {
        "conversations": [
            {
                "session_id": c["session_id"],
                "started_at": c["started_at"].isoformat(),
                "last_active": c["last_active"].isoformat(),
                "message_count": c["message_count"],
                "preview": c["preview"][:80] if c["preview"] else "",
            }
            for c in conversations
        ]
    }


@router.get("/conversations/{session_id}")
async def get_conversation(
    session_id: str,
    account: Account = Depends(get_current_account),
):
    """获取指定会话的所有消息"""
    async with async_session_factory() as db:
        result = await db.execute(
            select(Conversation)
            .where(
                Conversation.user_id == str(account.id),
                Conversation.session_id == session_id,
            )
            .order_by(Conversation.created_at)
        )
        rows = result.scalars().all()

    if not rows:
        return {"session_id": session_id, "messages": []}

    # 重建内存中的会话（如果已过期），便于继续对话
    if sessions.get(session_id) is None:
        history = []
        for row in rows:
            history.append(HumanMessage(content=row.message))
            history.append(AIMessage(content=row.response))
        sessions.create(session_id)
        sessions.update(session_id, history)

    return {
        "session_id": session_id,
        "messages": [
            {
                "id": row.id,
                "message": row.message,
                "response": row.response,
                "tool_calls": row.tool_calls,
                "created_at": row.created_at.isoformat(),
            }
            for row in rows
        ],
    }


# WebSocket 连接管理
class ConnectionManager:
    """WebSocket 连接管理器"""
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_message(self, message: str, user_id: str):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_json(message)


manager = ConnectionManager()


@router.websocket("/ws/{user_id}")
async def websocket_chat(websocket: WebSocket, user_id: str, token: str = ""):
    """WebSocket 实时聊天（需提供 token 认证）"""
    # Token 认证：验证 Bearer token
    from ..database import async_session_factory
    from ..models.account import Account
    from sqlalchemy import select

    ws_group_id = None
    ws_is_admin = False
    async with async_session_factory() as db:
        result = await db.execute(select(Account).where(Account.token == token))
        account = result.scalar_one_or_none()
        if not account or not account.is_active:
            await websocket.close(code=4001, reason="无效的认证令牌")
            return
        if str(account.id) != user_id:
            await websocket.close(code=4003, reason="令牌与用户不匹配")
            return
        ws_group_id = account.group_id
        ws_is_admin = account.role == "admin"

    await manager.connect(websocket, user_id)
    session_id = str(uuid.uuid4())

    try:
        # 发送欢迎消息
        await websocket.send_json({
            "type": "welcome",
            "message": WELCOME_MESSAGE,
            "session_id": session_id,
        })

        while True:
            # 接收消息
            data = await websocket.receive_json()
            message = data.get("message", "")

            if not message:
                continue

            # 处理消息
            history = sessions.get(session_id)
            if history is None:
                history = sessions.create(session_id)

            history.append(HumanMessage(content=message))

            # 调用 Agent
            agent = get_agent_graph()
            current_account_id.set(user_id)
            current_group_id.set(ws_group_id)
            current_is_admin.set(ws_is_admin)
            result = await agent.ainvoke({
                "messages": history,
                "user_id": user_id,
                "account_id": user_id,
                "group_id": ws_group_id,
            })

            # 提取响应
            response_message = result["messages"][-1]
            response_text = response_message.content

            # 更新会话历史
            sessions.update(session_id, result["messages"])

            # 发送响应
            await websocket.send_json({
                "type": "message",
                "response": response_text,
                "session_id": session_id,
            })

    except WebSocketDisconnect:
        manager.disconnect(user_id)
