"""待办事项 API 路由"""
from datetime import datetime, date, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, or_, case
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Todo
from ..models.account import Account
from ..auth import get_current_account

router = APIRouter(prefix="/api/todos", tags=["todos"])


class TodoCreate(BaseModel):
    """创建待办请求"""
    title: str
    description: Optional[str] = None
    due_date: Optional[str] = None  # YYYY-MM-DD
    priority: str = "medium"  # low/medium/high
    scope: str = "shared"  # personal/shared


class TodoUpdate(BaseModel):
    """更新待办请求"""
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = None
    completed: Optional[bool] = None
    scope: Optional[str] = None


class TodoResponse(BaseModel):
    """待办响应"""
    id: int
    title: str
    description: Optional[str]
    due_date: Optional[date]
    priority: str
    scope: str
    completed: bool
    completed_at: Optional[datetime]
    deleted: bool
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


@router.post("/", response_model=TodoResponse)
async def create_todo(
    todo_data: TodoCreate,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """创建待办"""
    todo = Todo(
        title=todo_data.title,
        description=todo_data.description,
        due_date=datetime.strptime(todo_data.due_date, "%Y-%m-%d").date() if todo_data.due_date else None,
        priority=todo_data.priority,
        scope=todo_data.scope,
        created_by=str(account.id),
        group_id=account.group_id if todo_data.scope == "shared" else None,
    )
    db.add(todo)
    await db.commit()
    await db.refresh(todo)
    return todo


@router.get("/", response_model=list[TodoResponse])
async def list_todos(
    completed: bool = False,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """获取待办列表（同组共享 + 个人）"""
    query = select(Todo)

    # 按用户组过滤：组内共享 + 自己创建的（含个人）
    if account.group_id is not None:
        query = query.where(or_(
            Todo.group_id == account.group_id,
            Todo.created_by == str(account.id),
        ))
    else:
        query = query.where(Todo.created_by == str(account.id))

    # 始终过滤已删除的待办
    query = query.where(Todo.deleted == False)

    if completed:
        query = query.where(Todo.completed == True)
    else:
        query = query.where(Todo.completed == False)
    priority_order = case(
        (Todo.priority == "high", 1),
        (Todo.priority == "medium", 2),
        (Todo.priority == "low", 3),
        else_=4,
    )
    query = query.order_by(priority_order, Todo.due_date)
    result = await db.execute(query)
    return result.scalars().all()


@router.put("/{todo_id}", response_model=TodoResponse)
async def update_todo(
    todo_id: int,
    todo_data: TodoUpdate,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """更新待办"""
    todo = await db.get(Todo, todo_id)
    if not todo:
        raise HTTPException(status_code=404, detail="待办不存在")

    # 权限检查：仅创建者或管理员可编辑
    is_owner = todo.created_by == str(account.id)
    is_admin = account.role == "admin"
    if not is_owner and not is_admin:
        raise HTTPException(status_code=403, detail="无权修改此待办")

    if todo_data.title is not None:
        todo.title = todo_data.title
    if todo_data.description is not None:
        todo.description = todo_data.description
    if todo_data.due_date is not None:
        if todo_data.due_date.strip() == "":
            todo.due_date = None
        else:
            todo.due_date = datetime.strptime(todo_data.due_date, "%Y-%m-%d").date()
    if todo_data.priority is not None:
        todo.priority = todo_data.priority
    if todo_data.completed is not None:
        todo.completed = todo_data.completed
        if todo_data.completed:
            todo.completed_at = datetime.now(timezone.utc)
    if todo_data.scope is not None:
        todo.scope = todo_data.scope
        todo.group_id = account.group_id if todo_data.scope == "shared" else None

    await db.commit()
    await db.refresh(todo)
    return todo


@router.post("/{todo_id}/complete", response_model=TodoResponse)
async def complete_todo(
    todo_id: int,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """完成待办"""
    todo = await db.get(Todo, todo_id)
    if not todo:
        raise HTTPException(status_code=404, detail="待办不存在")

    # 权限检查：创建者、管理员，或同组成员可操作共享待办
    is_owner = todo.created_by == str(account.id)
    is_admin = account.role == "admin"
    is_same_group = (
        todo.scope == "shared"
        and todo.group_id is not None
        and account.group_id == todo.group_id
    )
    if not is_owner and not is_admin and not is_same_group:
        raise HTTPException(status_code=403, detail="无权操作此待办")

    todo.completed = True
    todo.completed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(todo)
    return todo


@router.post("/{todo_id}/restore", response_model=TodoResponse)
async def restore_todo(
    todo_id: int,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """恢复已归档的待办"""
    todo = await db.get(Todo, todo_id)
    if not todo:
        raise HTTPException(status_code=404, detail="待办不存在")

    # 权限检查：创建者、管理员，或同组成员可操作共享待办
    is_owner = todo.created_by == str(account.id)
    is_admin = account.role == "admin"
    is_same_group = (
        todo.scope == "shared"
        and todo.group_id is not None
        and account.group_id == todo.group_id
    )
    if not is_owner and not is_admin and not is_same_group:
        raise HTTPException(status_code=403, detail="无权操作此待办")

    todo.completed = False
    todo.completed_at = None
    await db.commit()
    await db.refresh(todo)
    return todo


@router.delete("/{todo_id}")
async def delete_todo(
    todo_id: int,
    account: Account = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    """删除待办"""
    todo = await db.get(Todo, todo_id)
    if not todo:
        raise HTTPException(status_code=404, detail="待办不存在")

    # 权限检查：仅创建者或管理员可删除
    is_owner = todo.created_by == str(account.id)
    is_admin = account.role == "admin"
    if not is_owner and not is_admin:
        raise HTTPException(status_code=403, detail="无权删除此待办")

    todo.deleted = True
    await db.commit()
    return {"status": "ok", "message": f"已删除「{todo.title}」"}
