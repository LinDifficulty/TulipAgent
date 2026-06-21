"""纪念日 API 路由"""
from datetime import datetime, date, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Anniversary
from ..models.account import Account
from ..auth import get_current_account

router = APIRouter(prefix="/api/anniversaries", tags=["anniversaries"])


class AnniversaryCreate(BaseModel):
    """创建纪念日请求"""
    title: str
    description: Optional[str] = None
    date: str  # YYYY-MM-DD
    repeat_rule: str = "yearly"
    scope: str = "shared"  # personal/shared


class AnniversaryUpdate(BaseModel):
    """更新纪念日请求"""
    title: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    repeat_rule: Optional[str] = None
    scope: Optional[str] = None


class AnniversaryResponse(BaseModel):
    """纪念日响应"""
    id: int
    title: str
    description: Optional[str]
    date: date
    repeat_rule: str
    scope: str
    created_by: str

    class Config:
        from_attributes = True


@router.post("/", response_model=AnniversaryResponse)
async def create_anniversary(
    data: AnniversaryCreate,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """创建纪念日"""
    anniversary = Anniversary(
        title=data.title,
        description=data.description,
        date=datetime.strptime(data.date, "%Y-%m-%d").date(),
        repeat_rule=data.repeat_rule,
        scope=data.scope,
        created_by=str(account.id),
        group_id=account.group_id if data.scope == "shared" else None,
    )
    db.add(anniversary)
    await db.commit()
    await db.refresh(anniversary)
    return anniversary


@router.get("/", response_model=list[AnniversaryResponse])
async def list_anniversaries(
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """获取纪念日列表（同组共享 + 个人）"""
    query = select(Anniversary)

    if account.group_id is not None:
        query = query.where(or_(
            Anniversary.group_id == account.group_id,
            Anniversary.created_by == str(account.id),
        ))
    else:
        query = query.where(Anniversary.created_by == str(account.id))

    query = query.order_by(Anniversary.date)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{anniversary_id}", response_model=AnniversaryResponse)
async def get_anniversary(
    anniversary_id: int,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """获取单个纪念日"""
    anniversary = await db.get(Anniversary, anniversary_id)
    if not anniversary:
        raise HTTPException(status_code=404, detail="纪念日不存在")

    # 权限检查：自己创建的 或 同组共享的均可访问
    is_owner = anniversary.created_by == str(account.id)
    in_group = account.group_id is not None and anniversary.group_id == account.group_id
    if not is_owner and not in_group:
        raise HTTPException(status_code=403, detail="无权访问此纪念日")

    return anniversary


@router.put("/{anniversary_id}", response_model=AnniversaryResponse)
async def update_anniversary(
    anniversary_id: int,
    data: AnniversaryUpdate,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """更新纪念日"""
    anniversary = await db.get(Anniversary, anniversary_id)
    if not anniversary:
        raise HTTPException(status_code=404, detail="纪念日不存在")

    # 权限检查：仅创建者或管理员可修改
    is_owner = anniversary.created_by == str(account.id)
    is_admin = account.role == "admin"
    if not is_owner and not is_admin:
        raise HTTPException(status_code=403, detail="无权修改此纪念日")

    if data.title is not None:
        anniversary.title = data.title
    if data.description is not None:
        anniversary.description = data.description
    if data.date is not None:
        anniversary.date = datetime.strptime(data.date, "%Y-%m-%d").date()
    if data.repeat_rule is not None:
        anniversary.repeat_rule = data.repeat_rule
    if data.scope is not None:
        anniversary.scope = data.scope
        anniversary.group_id = account.group_id if data.scope == "shared" else None

    anniversary.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(anniversary)
    return anniversary


@router.delete("/{anniversary_id}")
async def delete_anniversary(
    anniversary_id: int,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """删除纪念日"""
    anniversary = await db.get(Anniversary, anniversary_id)
    if not anniversary:
        raise HTTPException(status_code=404, detail="纪念日不存在")

    # 权限检查：仅创建者或管理员可删除
    is_owner = anniversary.created_by == str(account.id)
    is_admin = account.role == "admin"
    if not is_owner and not is_admin:
        raise HTTPException(status_code=403, detail="无权删除此纪念日")

    title = anniversary.title
    await db.delete(anniversary)
    await db.commit()
    return {"status": "ok", "message": f"已删除纪念日「{title}」"}

