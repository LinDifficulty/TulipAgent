"""日程事件 API 路由"""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Event
from ..models.account import Account
from ..auth import get_current_account

router = APIRouter(prefix="/api/events", tags=["events"])


class EventCreate(BaseModel):
    """创建事件请求"""
    title: str
    description: Optional[str] = None
    start_time: str  # YYYY-MM-DD HH:MM
    end_time: Optional[str] = None
    all_day: bool = False
    remind_before: int = 30
    repeat_rule: str = "none"


class EventUpdate(BaseModel):
    """更新事件请求"""
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    remind_before: Optional[int] = None
    repeat_rule: Optional[str] = None


class EventResponse(BaseModel):
    """事件响应"""
    id: int
    title: str
    description: Optional[str]
    start_time: datetime
    end_time: Optional[datetime]
    all_day: bool
    remind_before: int
    repeat_rule: str
    created_by: str

    class Config:
        from_attributes = True


@router.post("/", response_model=EventResponse)
async def create_event(
    event_data: EventCreate,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """创建事件"""
    event = Event(
        title=event_data.title,
        description=event_data.description,
        start_time=datetime.strptime(event_data.start_time, "%Y-%m-%d %H:%M"),
        end_time=datetime.strptime(event_data.end_time, "%Y-%m-%d %H:%M") if event_data.end_time else None,
        all_day=event_data.all_day,
        remind_before=event_data.remind_before,
        repeat_rule=event_data.repeat_rule,
        created_by=str(account.id),
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


@router.get("/", response_model=list[EventResponse])
async def list_events(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """获取事件列表（仅自己的）"""
    query = select(Event)

    # 仅显示自己创建的事件
    query = query.where(Event.created_by == str(account.id))

    if start_date:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        query = query.where(Event.start_time >= start)

    if end_date:
        end = datetime.strptime(end_date, "%Y-%m-%d")
        query = query.where(Event.start_time <= end)

    query = query.order_by(Event.start_time)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: int,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """获取单个事件"""
    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="事件不存在")

    # 权限检查：仅创建者可访问
    if event.created_by != str(account.id):
        raise HTTPException(status_code=403, detail="无权访问此事件")

    return event


@router.put("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: int,
    event_data: EventUpdate,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """更新事件"""
    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="事件不存在")

    # 权限检查：仅创建者可修改
    if event.created_by != str(account.id):
        raise HTTPException(status_code=403, detail="无权修改此事件")

    if event_data.title is not None:
        event.title = event_data.title
    if event_data.description is not None:
        event.description = event_data.description
    if event_data.start_time is not None:
        event.start_time = datetime.strptime(event_data.start_time, "%Y-%m-%d %H:%M")
    if event_data.end_time is not None:
        event.end_time = datetime.strptime(event_data.end_time, "%Y-%m-%d %H:%M")
    if event_data.remind_before is not None:
        event.remind_before = event_data.remind_before
    if event_data.repeat_rule is not None:
        event.repeat_rule = event_data.repeat_rule

    event.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(event)
    return event


@router.delete("/{event_id}")
async def delete_event(
    event_id: int,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """删除事件"""
    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="事件不存在")

    # 权限检查：仅创建者可删除
    if event.created_by != str(account.id):
        raise HTTPException(status_code=403, detail="无权删除此事件")

    await db.delete(event)
    await db.commit()
    return {"status": "ok", "message": f"已删除事件「{event.title}」"}
