"""长期记忆模型"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, DateTime, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from ..database import Base


class Memory(Base):
    """长期记忆表 — Agent 记住的关于用户的重要事实"""
    __tablename__ = "memories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # 记忆内容（一条简洁的事实）
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # 分类: user_fact / important_date / decision / habit
    category: Mapped[str] = mapped_column(String(30), nullable=False, default="user_fact")

    # 关键词，逗号分隔，用于检索
    keywords: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # 归属
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False, index=True)
    group_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("user_groups.id"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    def __repr__(self):
        return f"<Memory {self.id}: {self.content[:30]}>"
