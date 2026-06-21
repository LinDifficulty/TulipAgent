"""快递追踪 API 路由"""
import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Package
from ..models.account import Account
from ..config import get_settings
from ..auth import get_current_account
from ..services.package_service import detect_carrier, refresh_package_status

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/packages", tags=["packages"])


class PackageCreate(BaseModel):
    """创建快递请求"""
    tracking_number: str
    item_name: str
    scope: str = "shared"  # personal/shared
    phone_last4: Optional[str] = None  # 手机号后四位（可选）


class PackageUpdate(BaseModel):
    """修改快递请求"""
    tracking_number: Optional[str] = None
    item_name: Optional[str] = None
    scope: Optional[str] = None
    phone_last4: Optional[str] = None  # 手机号后四位（可选）


class PackageResponse(BaseModel):
    """快递响应"""
    id: int
    tracking_number: str
    item_name: str
    phone_last4: Optional[str] = None
    carrier_code: Optional[str]
    carrier_name: Optional[str]
    status: str
    last_update: Optional[str]
    tracking_info: Optional[str]
    scope: str
    created_by: str
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class PackageDetailResponse(PackageResponse):
    """快递详情响应（含解析后的物流轨迹）"""
    tracking_list: list[dict] = []


@router.get("/test-config")
async def test_config():
    """测试快递100 API 配置 - 尝试所有端点"""
    settings = get_settings()
    has_customer = bool(settings.KUAIDI100_CUSTOMER)
    has_key = bool(settings.KUAIDI100_KEY)

    if not has_customer or not has_key:
        return {
            "configured": False,
            "customer": has_customer,
            "key": has_key,
            "message": "未配置完整，请在 .env 中设置 KUAIDI100_CUSTOMER 和 KUAIDI100_KEY",
        }

    # 构建签名
    param = json.dumps({"com": "jtexpress", "num": "JT5495958974895", "show": "0", "order": "desc"})
    sign_str = param + settings.KUAIDI100_KEY + settings.KUAIDI100_CUSTOMER
    sign = hashlib.md5(sign_str.encode("utf-8")).hexdigest().upper()

    results = {}
    endpoints = [
        ("poll", "https://poll.kuaidi100.com/poll/query.do"),
        ("api", "https://api.kuaidi100.com/api"),
    ]

    async with httpx.AsyncClient(timeout=10.0) as client:
        for name, url in endpoints:
            try:
                resp = await client.post(
                    url,
                    data={
                        "customer": settings.KUAIDI100_CUSTOMER,
                        "sign": sign,
                        "param": param,
                    },
                )
                is_json = False
                parsed = None
                try:
                    parsed = resp.json()
                    is_json = True
                except Exception:
                    pass

                results[name] = {
                    "url": url,
                    "http_status": resp.status_code,
                    "content_type": resp.headers.get("content-type", "N/A"),
                    "is_json": is_json,
                    "response": parsed if is_json else resp.text[:300],
                }
            except Exception as e:
                results[name] = {"url": url, "error": str(e)}

    return {
        "configured": True,
        "customer": settings.KUAIDI100_CUSTOMER,
        "sign": sign,
        "param_preview": param,
        "endpoints": results,
    }


@router.post("/", response_model=PackageResponse)
async def create_package(
    pkg_data: PackageCreate,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """添加快递（自动识别快递公司并查询状态）"""
    # 检查单号是否已存在
    existing = await db.execute(
        select(Package).where(Package.tracking_number == pkg_data.tracking_number)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该快递单号已存在")

    # 识别快递公司
    carrier_code, carrier_name = await detect_carrier(pkg_data.tracking_number)

    # 确定手机号后四位
    phone_last4 = pkg_data.phone_last4
    if not phone_last4 and account.phone and len(account.phone) >= 4:
        phone_last4 = account.phone[-4:]

    # 查询初始状态
    tracking_data = await refresh_package_status(carrier_code, pkg_data.tracking_number, phone_last4)

    package = Package(
        tracking_number=pkg_data.tracking_number,
        item_name=pkg_data.item_name,
        phone_last4=phone_last4,
        carrier_code=carrier_code,
        carrier_name=carrier_name,
        status=tracking_data["status"],
        last_update=tracking_data["last_update"],
        tracking_info=json.dumps(tracking_data["tracking_info"], ensure_ascii=False),
        scope=pkg_data.scope,
        created_by=str(account.id),
        group_id=account.group_id if pkg_data.scope == "shared" else None,
    )
    db.add(package)
    await db.commit()
    await db.refresh(package)
    return package


@router.get("/", response_model=list[PackageResponse])
async def list_packages(
    status: Optional[str] = None,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """获取快递列表（同组共享 + 个人）"""
    query = select(Package)

    # 按用户组过滤：组内共享 + 自己创建的（含个人）
    if account.group_id is not None:
        query = query.where(or_(
            Package.group_id == account.group_id,
            Package.created_by == str(account.id),
        ))
    else:
        query = query.where(Package.created_by == str(account.id))

    if status:
        query = query.where(Package.status == status)
    query = query.order_by(Package.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{package_id}", response_model=PackageDetailResponse)
async def get_package(
    package_id: int,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """获取快递详情（含物流轨迹）"""
    package = await db.get(Package, package_id)
    if not package:
        raise HTTPException(status_code=404, detail="快递不存在")

    # 权限检查：自己创建的 或 同组共享的均可访问
    is_owner = package.created_by == str(account.id)
    in_group = account.group_id is not None and package.group_id == account.group_id
    if not is_owner and not in_group:
        raise HTTPException(status_code=403, detail="无权访问此快递")

    # 解析物流轨迹
    tracking_list = []
    if package.tracking_info:
        try:
            tracking_list = json.loads(package.tracking_info)
        except json.JSONDecodeError:
            pass

    return PackageDetailResponse(
        **PackageResponse.model_validate(package).model_dump(),
        tracking_list=tracking_list,
    )


@router.put("/{package_id}", response_model=PackageResponse)
async def update_package(
    package_id: int,
    pkg_data: PackageUpdate,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """修改快递信息"""
    package = await db.get(Package, package_id)
    if not package:
        raise HTTPException(status_code=404, detail="快递不存在")

    # 权限检查：仅创建者或管理员可修改
    is_owner = package.created_by == str(account.id)
    is_admin = account.role == "admin"
    if not is_owner and not is_admin:
        raise HTTPException(status_code=403, detail="无权修改此快递")

    # 如果修改了单号，检查是否与其他记录冲突
    if pkg_data.tracking_number and pkg_data.tracking_number != package.tracking_number:
        existing = await db.execute(
            select(Package).where(
                Package.tracking_number == pkg_data.tracking_number,
                Package.id != package_id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="该快递单号已存在")
        package.tracking_number = pkg_data.tracking_number
        # 单号变更后重新识别快递公司并刷新状态
        carrier_code, carrier_name = await detect_carrier(pkg_data.tracking_number)
        package.carrier_code = carrier_code
        package.carrier_name = carrier_name
        tracking_data = await refresh_package_status(carrier_code, pkg_data.tracking_number, package.phone_last4)
        package.status = tracking_data["status"]
        package.last_update = tracking_data["last_update"]
        package.tracking_info = json.dumps(tracking_data["tracking_info"], ensure_ascii=False)

    if pkg_data.item_name is not None:
        package.item_name = pkg_data.item_name
    if pkg_data.phone_last4 is not None:
        package.phone_last4 = pkg_data.phone_last4 or None
    if pkg_data.scope is not None:
        package.scope = pkg_data.scope
        package.group_id = account.group_id if pkg_data.scope == "shared" else None

    package.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(package)
    return package


@router.post("/{package_id}/refresh", response_model=PackageResponse)
async def refresh_package(
    package_id: int,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """手动刷新快递状态"""
    package = await db.get(Package, package_id)
    if not package:
        raise HTTPException(status_code=404, detail="快递不存在")

    # 权限检查：仅创建者或管理员可操作
    is_owner = package.created_by == str(account.id)
    is_admin = account.role == "admin"
    if not is_owner and not is_admin:
        raise HTTPException(status_code=403, detail="无权操作此快递")

    data = await refresh_package_status(package.carrier_code or "unknown", package.tracking_number, package.phone_last4)
    package.status = data["status"]
    package.last_update = data["last_update"]
    package.tracking_info = json.dumps(data["tracking_info"], ensure_ascii=False)
    package.updated_at = datetime.now(timezone.utc)

    # 如果识别出了快递公司（之前是 unknown），更新快递公司信息
    if "carrier_code" in data and package.carrier_code == "unknown":
        package.carrier_code = data["carrier_code"]
        package.carrier_name = data["carrier_name"]
        logger.info(f"更新快递公司: {package.tracking_number} -> {data['carrier_name']} ({data['carrier_code']})")

    await db.commit()
    await db.refresh(package)
    return package


@router.delete("/{package_id}")
async def delete_package(
    package_id: int,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """删除快递"""
    package = await db.get(Package, package_id)
    if not package:
        raise HTTPException(status_code=404, detail="快递不存在")

    # 权限检查：仅创建者或管理员可删除
    is_owner = package.created_by == str(account.id)
    is_admin = account.role == "admin"
    if not is_owner and not is_admin:
        raise HTTPException(status_code=403, detail="无权删除此快递")

    await db.delete(package)
    await db.commit()
    return {"status": "ok", "message": f"已删除快递「{package.item_name}」({package.tracking_number})"}
