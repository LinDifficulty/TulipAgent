"""认证路由"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.account import Account
from ..auth import get_current_account

router = APIRouter(prefix="/api/auth", tags=["认证"])


class LoginRequest(BaseModel):
    """登录请求"""
    token: str


class UpdateProfileRequest(BaseModel):
    """更新个人资料请求"""
    nickname: str | None = None
    phone: str | None = None
    token: str | None = None


class AccountInfo(BaseModel):
    """账户信息"""
    id: int
    token: str
    nickname: str
    phone: str | None
    role: str
    group_id: int | None

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    """登录响应"""
    token: str
    account: AccountInfo


@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """用令牌登录"""
    result = await db.execute(select(Account).where(Account.token == req.token))
    account = result.scalar_one_or_none()

    if account is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的令牌",
        )

    if not account.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账户已被禁用",
        )

    return LoginResponse(
        token=account.token,
        account=AccountInfo.model_validate(account),
    )


@router.get("/me", response_model=AccountInfo)
async def get_me(account: Account = Depends(get_current_account)):
    """获取当前账户信息"""
    return AccountInfo.model_validate(account)


@router.get("/check")
async def check_token(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """检查令牌是否有效"""
    result = await db.execute(select(Account).where(Account.token == token))
    account = result.scalar_one_or_none()

    if account is None or not account.is_active:
        return {"valid": False}

    return {
        "valid": True,
        "role": account.role,
    }


@router.put("/me", response_model=AccountInfo)
async def update_profile(
    req: UpdateProfileRequest,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """更新当前用户的个人资料（昵称、手机号、令牌）"""
    # 更新昵称
    if req.nickname is not None and req.nickname.strip():
        nickname = req.nickname.strip()
        if len(nickname) > 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="昵称不能超过50个字符",
            )
        account.nickname = nickname

    # 更新手机号：允许为空或纯数字（可选带+号）
    if req.phone is not None:
        if req.phone.strip():
            phone = req.phone.strip()
            if not phone.replace("+", "").isdigit():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="手机号格式不正确",
                )
            account.phone = phone
        else:
            account.phone = None

    # 更新令牌
    if req.token is not None and req.token.strip():
        new_token = req.token.strip()
        if len(new_token) > 128:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="令牌不能超过128个字符",
            )
        # 检查令牌是否已被其他账户使用
        existing = await db.execute(
            select(Account).where(Account.token == new_token, Account.id != account.id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该令牌已被其他账户使用",
            )
        account.token = new_token

    await db.commit()
    await db.refresh(account)
    return AccountInfo.model_validate(account)
