"""对话历史模型"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime, Integer, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column
from ..database import Base


class Conversation(Base):
    """对话历史表"""
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(50), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    response: Mapped[str] = mapped_column(Text, nullable=False)

    # 工具调用记录
    tool_calls: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # 会话ID (用于多轮对话)
    session_id: Mapped[str] = mapped_column(String(50), nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Conversation {self.id}: {self.user_id}>"
