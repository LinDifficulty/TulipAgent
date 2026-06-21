"""管理后台路由 - 仅 admin 可访问"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.account import Account
from ..models.group import UserGroup
from ..auth import require_admin

router = APIRouter(prefix="/api/admin", tags=["管理后台"])


# ──────────────────────────── Pydantic 模型 ────────────────────────────

class AccountCreate(BaseModel):
    """创建账号"""
    token: str
    nickname: str
    phone: str | None = None
    role: str = "user"
    group_id: int | None = None


class AccountUpdate(BaseModel):
    """更新账号"""
    token: str | None = None
    nickname: str | None = None
    phone: str | None = None
    role: str | None = None
    group_id: int | None = None
    is_active: bool | None = None


class AccountResponse(BaseModel):
    """账号响应"""
    id: int
    token: str
    nickname: str
    phone: str | None
    role: str
    group_id: int | None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class GroupCreate(BaseModel):
    """创建用户组"""
    name: str
    description: str | None = None


class GroupUpdate(BaseModel):
    """更新用户组"""
    name: str | None = None
    description: str | None = None


class GroupResponse(BaseModel):
    """用户组响应"""
    id: int
    name: str
    description: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class GroupMemberResponse(BaseModel):
    """组成员响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    token: str
    nickname: str
    role: str
    is_active: bool


class AddMemberRequest(BaseModel):
    """添加成员请求"""
    account_id: int


# ──────────────────────────── 账号管理 ────────────────────────────

@router.get("/accounts", response_model=list[AccountResponse])
async def list_accounts(
    admin: Account = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """列出所有账号"""
    result = await db.execute(select(Account).order_by(Account.id))
    return [AccountResponse.model_validate(a) for a in result.scalars().all()]


@router.post("/accounts", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    data: AccountCreate,
    admin: Account = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """创建新账号"""
    # 检查 token 唯一性
    existing = await db.execute(select(Account).where(Account.token == data.token))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="令牌已存在")

    # 检查角色合法性
    if data.role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="角色必须为 admin 或 user")

    # 检查用户组是否存在
    if data.group_id is not None:
        group = await db.get(UserGroup, data.group_id)
        if group is None:
            raise HTTPException(status_code=400, detail="用户组不存在")

    account = Account(
        token=data.token,
        nickname=data.nickname,
        phone=data.phone,
        role=data.role,
        group_id=data.group_id,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return AccountResponse.model_validate(account)


@router.put("/accounts/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: int,
    data: AccountUpdate,
    admin: Account = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """更新账号"""
    account = await db.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="账号不存在")

    if data.token is not None:
        # 检查 token 唯一性
        existing = await db.execute(
            select(Account).where(Account.token == data.token, Account.id != account_id)
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status_code=400, detail="令牌已存在")
        account.token = data.token

    if data.nickname is not None:
        account.nickname = data.nickname

    if data.phone is not None:
        account.phone = data.phone

    if data.role is not None:
        if data.role not in ("admin", "user"):
            raise HTTPException(status_code=400, detail="角色必须为 admin 或 user")
        account.role = data.role

    if data.group_id is not None:
        if data.group_id == 0:
            # 0 表示清除分组，设为独立用户
            account.group_id = None
        else:
            group = await db.get(UserGroup, data.group_id)
            if group is None:
                raise HTTPException(status_code=400, detail="用户组不存在")
            account.group_id = data.group_id

    if data.is_active is not None:
        account.is_active = data.is_active

    await db.commit()
    await db.refresh(account)
    return AccountResponse.model_validate(account)


@router.delete("/accounts/{account_id}")
async def delete_account(
    account_id: int,
    admin: Account = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """删除账号"""
    account = await db.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="账号不存在")

    # 不能删除自己
    if account.id == admin.id:
        raise HTTPException(status_code=400, detail="不能删除自己的账号")

    await db.delete(account)
    await db.commit()
    return {"message": "账号已删除"}


# ──────────────────────────── 用户组管理 ────────────────────────────

@router.get("/groups", response_model=list[GroupResponse])
async def list_groups(
    admin: Account = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """列出所有用户组"""
    result = await db.execute(select(UserGroup).order_by(UserGroup.id))
    return [GroupResponse.model_validate(g) for g in result.scalars().all()]


@router.post("/groups", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    data: GroupCreate,
    admin: Account = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """创建用户组"""
    # 检查名称唯一性
    existing = await db.execute(select(UserGroup).where(UserGroup.name == data.name))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="用户组名称已存在")

    group = UserGroup(name=data.name, description=data.description)
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return GroupResponse.model_validate(group)


@router.put("/groups/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: int,
    data: GroupUpdate,
    admin: Account = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """更新用户组"""
    group = await db.get(UserGroup, group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="用户组不存在")

    if data.name is not None:
        existing = await db.execute(
            select(UserGroup).where(UserGroup.name == data.name, UserGroup.id != group_id)
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status_code=400, detail="用户组名称已存在")
        group.name = data.name

    if data.description is not None:
        group.description = data.description

    await db.commit()
    await db.refresh(group)
    return GroupResponse.model_validate(group)


@router.delete("/groups/{group_id}")
async def delete_group(
    group_id: int,
    admin: Account = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """删除用户组"""
    group = await db.get(UserGroup, group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="用户组不存在")

    # 将该组下的账号的 group_id 设为 None
    result = await db.execute(select(Account).where(Account.group_id == group_id))
    for account in result.scalars().all():
        account.group_id = None

    await db.delete(group)
    await db.commit()
    return {"message": "用户组已删除"}


@router.get("/groups/{group_id}/members", response_model=list[GroupMemberResponse])
async def list_group_members(
    group_id: int,
    admin: Account = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """获取组内成员"""
    group = await db.get(UserGroup, group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="用户组不存在")

    result = await db.execute(
        select(Account).where(Account.group_id == group_id).order_by(Account.id)
    )
    return [GroupMemberResponse.model_validate(a) for a in result.scalars().all()]


@router.post("/groups/{group_id}/members", response_model=GroupMemberResponse)
async def add_group_member(
    group_id: int,
    data: AddMemberRequest,
    admin: Account = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """将用户添加到用户组"""
    group = await db.get(UserGroup, group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="用户组不存在")

    account = await db.get(Account, data.account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="账号不存在")

    account.group_id = group_id
    await db.commit()
    await db.refresh(account)
    return GroupMemberResponse.model_validate(account)


@router.delete("/groups/{group_id}/members/{account_id}")
async def remove_group_member(
    group_id: int,
    account_id: int,
    admin: Account = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """将用户从用户组移除"""
    group = await db.get(UserGroup, group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="用户组不存在")

    account = await db.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="账号不存在")

    if account.group_id != group_id:
        raise HTTPException(status_code=400, detail="该用户不在此用户组中")

    account.group_id = None
    await db.commit()
    return {"message": "已将用户移出用户组"}
