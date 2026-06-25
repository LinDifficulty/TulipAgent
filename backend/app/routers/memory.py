"""长期记忆 API 路由"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.memory import Memory
from ..models.account import Account
from ..auth import get_current_account

router = APIRouter(prefix="/api/memories", tags=["memories"])


class MemoryCreate(BaseModel):
    """创建记忆请求"""
    content: str
    category: str = "user_fact"  # user_fact / important_date / decision / habit
    keywords: Optional[str] = None


class MemoryUpdate(BaseModel):
    """更新记忆请求"""
    content: Optional[str] = None
    category: Optional[str] = None
    keywords: Optional[str] = None


class MemoryResponse(BaseModel):
    """记忆响应"""
    id: int
    content: str
    category: str
    keywords: Optional[str]
    account_id: int
    created_at: datetime
    last_used_at: Optional[datetime]

    class Config:
        from_attributes = True


@router.post("/", response_model=MemoryResponse)
async def create_memory(
    data: MemoryCreate,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """保存一条长期记忆"""
    memory = Memory(
        content=data.content,
        category=data.category,
        keywords=data.keywords,
        account_id=account.id,
        group_id=account.group_id,
    )
    db.add(memory)
    await db.commit()
    await db.refresh(memory)
    return memory


@router.get("/", response_model=list[MemoryResponse])
async def list_memories(
    category: Optional[str] = None,
    q: Optional[str] = None,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """获取记忆列表"""
    query = select(Memory)

    # 按用户组过滤：组内共享 + 自己的
    if account.group_id is not None:
        query = query.where(or_(
            Memory.group_id == account.group_id,
            Memory.account_id == account.id,
        ))
    else:
        query = query.where(Memory.account_id == account.id)

    if category:
        query = query.where(Memory.category == category)

    if q:
        query = query.where(Memory.content.ilike(f"%{q}%"))

    query = query.order_by(Memory.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.put("/{memory_id}", response_model=MemoryResponse)
async def update_memory(
    memory_id: int,
    data: MemoryUpdate,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """更新记忆"""
    memory = await db.get(Memory, memory_id)
    if not memory:
        raise HTTPException(status_code=404, detail="记忆不存在")

    # 权限检查
    if memory.account_id != account.id:
        raise HTTPException(status_code=403, detail="无权修改此记忆")

    if data.content is not None:
        memory.content = data.content
    if data.category is not None:
        memory.category = data.category
    if data.keywords is not None:
        memory.keywords = data.keywords

    await db.commit()
    await db.refresh(memory)
    return memory


@router.delete("/{memory_id}")
async def delete_memory(
    memory_id: int,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """删除记忆"""
    memory = await db.get(Memory, memory_id)
    if not memory:
        raise HTTPException(status_code=404, detail="记忆不存在")

    if memory.account_id != account.id:
        raise HTTPException(status_code=403, detail="无权删除此记忆")

    await db.delete(memory)
    await db.commit()
    return {"status": "ok", "message": f"已删除记忆"}
