"""工作日志模型"""
from datetime import datetime, date, timezone
from typing import Optional
from sqlalchemy import String, Date, DateTime, Integer, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from ..database import Base


class WorkLog(Base):
    """工作日志表 - 每天一条记录，content存储多条工作内容的JSON数组"""
    __tablename__ = "work_logs"
    __table_args__ = (
        UniqueConstraint('created_by', 'log_date', name='uq_user_log_date'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)  # JSON数组，存储多条工作内容
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # AI生成的当日总结
    log_date: Mapped[date] = mapped_column(Date, nullable=False)  # 日志日期
    log_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)  # 日志时间

    # 分类标签（可选）
    tags: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # JSON数组存储标签

    # 创建者
    created_by: Mapped[str] = mapped_column(String(50), nullable=False)
    group_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("user_groups.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    def __repr__(self):
        return f"<WorkLog {self.id}: {self.log_date}>"
