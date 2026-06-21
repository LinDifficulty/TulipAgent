"""待办事项模型"""
from datetime import datetime, date, timezone
from typing import Optional
from sqlalchemy import String, Date, DateTime, Integer, Text, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from ..database import Base


class Todo(Base):
    """待办事项表"""
    __tablename__ = "todos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    priority: Mapped[str] = mapped_column(String(10), default="medium")  # low/medium/high
    # 状态
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    deleted: Mapped[bool] = mapped_column(Boolean, default=False)

    # 可见范围 (personal: 仅自己可见, shared: 组内共享)
    scope: Mapped[str] = mapped_column(String(20), default="shared")

    # 创建者
    created_by: Mapped[str] = mapped_column(String(50), nullable=False)
    group_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("user_groups.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<Todo {self.id}: {self.title}>"
