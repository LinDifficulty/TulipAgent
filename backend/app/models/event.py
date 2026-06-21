"""日程事件模型"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, DateTime, Integer, Text, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from ..database import Base


class Event(Base):
    """日程事件表"""
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    all_day: Mapped[bool] = mapped_column(Boolean, default=False)

    # 提醒设置
    remind_before: Mapped[int] = mapped_column(Integer, default=30)  # 提前多少分钟提醒
    reminded: Mapped[bool] = mapped_column(Boolean, default=False)

    # 重复规则 (none, daily, weekly, monthly, yearly)
    repeat_rule: Mapped[str] = mapped_column(String(20), default="none")

    # 创建者
    created_by: Mapped[str] = mapped_column(String(50), nullable=False)
    group_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("user_groups.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    def __repr__(self):
        return f"<Event {self.id}: {self.title}>"
