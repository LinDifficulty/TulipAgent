"""工作日志 API 路由"""
import json
from datetime import datetime, date, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import WorkLog
from ..models.account import Account
from ..auth import get_current_account

router = APIRouter(prefix="/api/work-logs", tags=["work-logs"])


class WorkLogAddContent(BaseModel):
    """添加工作内容请求"""
    content: str  # 单条工作内容
    log_date: Optional[str] = None  # YYYY-MM-DD，默认今天


class WorkLogUpdateContent(BaseModel):
    """更新工作内容请求"""
    content_index: int  # 要更新的内容索引
    new_content: str  # 新的内容


class WorkLogUpdate(BaseModel):
    """更新工作日志请求"""
    summary: Optional[str] = None
    tags: Optional[str] = None


class ContentItem(BaseModel):
    """单条工作内容"""
    index: int
    content: str
    added_at: str  # 添加时间


class WorkLogResponse(BaseModel):
    """工作日志响应"""
    id: int
    contents: list[ContentItem]  # 所有工作内容列表
    summary: Optional[str]
    log_date: date
    tags: Optional[str]
    created_by: str
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_model(cls, log: WorkLog) -> "WorkLogResponse":
        """从ORM模型创建响应"""
        try:
            contents_data = json.loads(log.content) if log.content else []
        except json.JSONDecodeError:
            # 兼容旧格式（纯文本）
            contents_data = [{"content": log.content, "added_at": log.created_at.isoformat()}]

        contents = [
            ContentItem(
                index=i,
                content=item.get("content", ""),
                added_at=item.get("added_at", log.created_at.isoformat()),
            )
            for i, item in enumerate(contents_data)
        ]

        return cls(
            id=log.id,
            contents=contents,
            summary=log.summary,
            log_date=log.log_date,
            tags=log.tags,
            created_by=log.created_by,
            created_at=log.created_at,
            updated_at=log.updated_at,
        )


@router.post("/add", response_model=WorkLogResponse)
async def add_work_log_content(
    data: WorkLogAddContent,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """添加工作内容到当天日志（如不存在则自动创建）"""
    log_date = datetime.strptime(data.log_date, "%Y-%m-%d").date() if data.log_date else date.today()
    now = datetime.now(timezone.utc)

    # 查询当天的日志
    query = select(WorkLog).where(
        WorkLog.created_by == str(account.id),
        WorkLog.log_date == log_date,
    )
    result = await db.execute(query)
    work_log = result.scalar_one_or_none()

    if work_log:
        # 追加内容到现有日志
        try:
            contents = json.loads(work_log.content)
        except json.JSONDecodeError:
            contents = [{"content": work_log.content, "added_at": work_log.created_at.isoformat()}]

        contents.append({
            "content": data.content,
            "added_at": now.isoformat(),
        })
        work_log.content = json.dumps(contents, ensure_ascii=False)
        work_log.updated_at = now
    else:
        # 创建新的日志
        contents = [{
            "content": data.content,
            "added_at": now.isoformat(),
        }]
        work_log = WorkLog(
            content=json.dumps(contents, ensure_ascii=False),
            log_date=log_date,
            created_by=str(account.id),
            group_id=None,
        )
        db.add(work_log)

    await db.commit()
    await db.refresh(work_log)
    return WorkLogResponse.from_orm_model(work_log)


@router.get("/", response_model=list[WorkLogResponse])
async def list_work_logs(
    start_date: Optional[str] = Query(None, description="开始日期 YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD"),
    limit: int = Query(50, ge=1, le=200),
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """获取工作日志列表"""
    query = select(WorkLog)

    # 个人独占：始终按创建者过滤
    query = query.where(WorkLog.created_by == str(account.id))

    # 日期过滤
    if start_date:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        query = query.where(WorkLog.log_date >= start)
    if end_date:
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
        query = query.where(WorkLog.log_date <= end)

    query = query.order_by(WorkLog.log_date.desc()).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()
    return [WorkLogResponse.from_orm_model(log) for log in logs]


@router.get("/summary/weekly", response_model=dict)
async def get_weekly_summary(
    week_offset: int = Query(0, description="周偏移量，0=本周，-1=上周"),
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """获取本周工作日志汇总"""
    today = date.today()
    weekday = today.weekday()
    week_start = today - timedelta(days=weekday) + timedelta(weeks=week_offset)
    week_end = week_start + timedelta(days=6)

    query = select(WorkLog).where(
        WorkLog.created_by == str(account.id),
        and_(WorkLog.log_date >= week_start, WorkLog.log_date <= week_end),
    ).order_by(WorkLog.log_date)

    result = await db.execute(query)
    logs = result.scalars().all()

    return {
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "logs": [WorkLogResponse.from_orm_model(log) for log in logs],
        "total_count": len(logs),
    }


@router.get("/summary/monthly", response_model=dict)
async def get_monthly_summary(
    year: Optional[int] = Query(None, description="年份"),
    month: Optional[int] = Query(None, description="月份"),
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """获取本月工作日志汇总"""
    today = date.today()
    target_year = year or today.year
    target_month = month or today.month

    month_start = date(target_year, target_month, 1)
    if target_month == 12:
        month_end = date(target_year + 1, 1, 1) - timedelta(days=1)
    else:
        month_end = date(target_year, target_month + 1, 1) - timedelta(days=1)

    query = select(WorkLog).where(
        WorkLog.created_by == str(account.id),
        and_(WorkLog.log_date >= month_start, WorkLog.log_date <= month_end),
    ).order_by(WorkLog.log_date)

    result = await db.execute(query)
    logs = result.scalars().all()

    return {
        "year": target_year,
        "month": target_month,
        "month_start": month_start.isoformat(),
        "month_end": month_end.isoformat(),
        "logs": [WorkLogResponse.from_orm_model(log) for log in logs],
        "total_count": len(logs),
    }


@router.get("/{log_id}", response_model=WorkLogResponse)
async def get_work_log(
    log_id: int,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """获取单条工作日志"""
    work_log = await db.get(WorkLog, log_id)
    if not work_log:
        raise HTTPException(status_code=404, detail="工作日志不存在")

    # 权限检查：个人独占
    if work_log.created_by != str(account.id):
        raise HTTPException(status_code=403, detail="无权查看此工作日志")

    return WorkLogResponse.from_orm_model(work_log)


@router.put("/{log_id}/content/{content_index}", response_model=WorkLogResponse)
async def update_work_log_content(
    log_id: int,
    content_index: int,
    data: WorkLogUpdateContent,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """更新指定工作内容"""
    work_log = await db.get(WorkLog, log_id)
    if not work_log:
        raise HTTPException(status_code=404, detail="工作日志不存在")

    # 权限检查：个人独占
    if work_log.created_by != str(account.id):
        raise HTTPException(status_code=403, detail="无权修改此工作日志")

    try:
        contents = json.loads(work_log.content)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="日志内容格式错误")

    if content_index < 0 or content_index >= len(contents):
        raise HTTPException(status_code=400, detail="内容索引无效")

    contents[content_index]["content"] = data.new_content
    work_log.content = json.dumps(contents, ensure_ascii=False)
    work_log.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(work_log)
    return WorkLogResponse.from_orm_model(work_log)


@router.delete("/{log_id}/content/{content_index}", response_model=WorkLogResponse)
async def delete_work_log_content(
    log_id: int,
    content_index: int,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """删除指定工作内容"""
    work_log = await db.get(WorkLog, log_id)
    if not work_log:
        raise HTTPException(status_code=404, detail="工作日志不存在")

    # 权限检查：个人独占
    if work_log.created_by != str(account.id):
        raise HTTPException(status_code=403, detail="无权修改此工作日志")

    try:
        contents = json.loads(work_log.content)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="日志内容格式错误")

    if content_index < 0 or content_index >= len(contents):
        raise HTTPException(status_code=400, detail="内容索引无效")

    contents.pop(content_index)

    if not contents:
        # 如果没有内容了，删除整条日志
        await db.delete(work_log)
        await db.commit()
        raise HTTPException(status_code=404, detail="日志已删除")

    work_log.content = json.dumps(contents, ensure_ascii=False)
    work_log.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(work_log)
    return WorkLogResponse.from_orm_model(work_log)


@router.put("/{log_id}", response_model=WorkLogResponse)
async def update_work_log(
    log_id: int,
    log_data: WorkLogUpdate,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """更新工作日志（摘要、标签）"""
    work_log = await db.get(WorkLog, log_id)
    if not work_log:
        raise HTTPException(status_code=404, detail="工作日志不存在")

    # 权限检查：个人独占
    if work_log.created_by != str(account.id):
        raise HTTPException(status_code=403, detail="无权修改此工作日志")

    if log_data.summary is not None:
        work_log.summary = log_data.summary
    if log_data.tags is not None:
        work_log.tags = log_data.tags

    work_log.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(work_log)
    return WorkLogResponse.from_orm_model(work_log)


@router.delete("/{log_id}")
async def delete_work_log(
    log_id: int,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """删除整条工作日志"""
    work_log = await db.get(WorkLog, log_id)
    if not work_log:
        raise HTTPException(status_code=404, detail="工作日志不存在")

    # 权限检查：个人独占
    if work_log.created_by != str(account.id):
        raise HTTPException(status_code=403, detail="无权删除此工作日志")

    await db.delete(work_log)
    await db.commit()
    return {"status": "ok", "message": "已删除工作日志"}
