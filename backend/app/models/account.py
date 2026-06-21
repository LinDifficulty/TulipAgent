"""账户模型"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, DateTime, Boolean, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from ..database import Base


class Account(Base):
    """账户表 - 令牌登录，区分 admin/user 角色"""
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    token: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    nickname: Mapped[str] = mapped_column(String(50), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    role: Mapped[str] = mapped_column(String(10), default="user")  # admin / user
    group_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("user_groups.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<Account {self.id}: {self.nickname} ({self.role})>"
