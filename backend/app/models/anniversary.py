"""纪念日模型"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, DateTime, Date, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from ..database import Base


class Anniversary(Base):
    """纪念日表"""
    __tablename__ = "anniversaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    date: Mapped[datetime] = mapped_column(Date, nullable=False)

    # 重复规则 (yearly by default, none for one-time)
    repeat_rule: Mapped[str] = mapped_column(String(20), default="yearly")

    # 可见范围 (personal: 仅自己可见, shared: 组内共享)
    scope: Mapped[str] = mapped_column(String(20), default="shared")

    # 创建者
    created_by: Mapped[str] = mapped_column(String(50), nullable=False)
    group_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("user_groups.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    def __repr__(self):
        return f"<Anniversary {self.id}: {self.title}>"

