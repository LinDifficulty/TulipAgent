"""快递追踪模型"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, DateTime, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from ..database import Base


class Package(Base):
    """快递追踪表"""
    __tablename__ = "packages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tracking_number: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    item_name: Mapped[str] = mapped_column(String(200), nullable=False)

    # 手机号后四位（部分快递公司查询需要）
    phone_last4: Mapped[Optional[str]] = mapped_column(String(4), nullable=True)

    # 快递公司信息
    carrier_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # 如 shunfeng, zhongtong
    carrier_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # 如 顺丰速运, 中通快递

    # 快递状态
    status: Mapped[str] = mapped_column(String(50), default="未发货")  # 未发货/运输中/派送中/已签收/查询失败
    last_update: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # 最新一条物流信息

    # 物流轨迹 JSON 字符串
    tracking_info: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # 可见范围 (personal: 仅自己可见, shared: 组内共享)
    scope: Mapped[str] = mapped_column(String(20), default="shared")

    # 创建者
    created_by: Mapped[str] = mapped_column(String(50), nullable=False)
    group_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("user_groups.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    def __repr__(self):
        return f"<Package {self.id}: {self.tracking_number} ({self.status})>"
