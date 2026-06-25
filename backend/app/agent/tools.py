"""Agent 工具定义"""
import json
from datetime import datetime, date, timedelta, timezone
from typing import Optional
from langchain_core.tools import tool
from sqlalchemy import select, func, or_, case
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import async_session_factory
from ..models import Event, Todo, Package, Anniversary, WorkLog, Memory
from ..models.account import Account
from ..services.package_service import detect_carrier, refresh_package_status
from .context import current_account_id, current_group_id, current_is_admin


# ==================== 日程工具 ====================

@tool
async def create_event(
    title: str,
    start_time: str,
    end_time: Optional[str] = None,
    description: Optional[str] = None,
    remind_before: int = 30,
    repeat_rule: str = "none",
) -> str:
    """创建日程事件。

    Args:
        title: 事件标题
        start_time: 开始时间，格式：YYYY-MM-DD HH:MM
        end_time: 结束时间，格式：YYYY-MM-DD HH:MM（可选）
        description: 事件描述（可选）
        remind_before: 提前提醒分钟数，默认30
        repeat_rule: 重复规则（none/daily/weekly/monthly/yearly）
    """
    account_id = current_account_id.get()

    async with async_session_factory() as session:
        event = Event(
            title=title,
            description=description,
            start_time=datetime.strptime(start_time, "%Y-%m-%d %H:%M"),
            end_time=datetime.strptime(end_time, "%Y-%m-%d %H:%M") if end_time else None,
            remind_before=remind_before,
            repeat_rule=repeat_rule,
            created_by=account_id or "system",
        )
        session.add(event)
        await session.commit()
        return f"✅ 已创建事件「{title}」，时间：{start_time}"


@tool
async def list_events(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> str:
    """查询日程事件列表。

    Args:
        start_date: 开始日期，格式：YYYY-MM-DD（可选，默认今天）
        end_date: 结束日期，格式：YYYY-MM-DD（可选，默认7天后）
    """
    account_id = current_account_id.get()

    async with async_session_factory() as session:
        query = select(Event)

        # 仅显示自己创建的事件
        if account_id:
            query = query.where(Event.created_by == account_id)

        if start_date:
            start = datetime.strptime(start_date, "%Y-%m-%d")
        else:
            start = datetime.now().replace(hour=0, minute=0, second=0)

        if end_date:
            # 将结束日期设为当天 23:59:59，确保包含该日全天的事件
            end = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        else:
            # 默认查询 7 天内，包含第 7 天全天
            end = (start + timedelta(days=7)).replace(hour=23, minute=59, second=59)

        # 匹配：事件开始时间在范围内 或 跨天事件（end_time 在范围内）
        query = query.where(or_(
            Event.start_time.between(start, end),
            Event.end_time.between(start, end),
        ))

        query = query.order_by(Event.start_time)
        result = await session.execute(query)
        events = result.scalars().all()

        if not events:
            return "📅 暂无日程安排"

        lines = ["📅 日程列表："]
        for e in events:
            time_str = e.start_time.strftime("%m-%d %H:%M")
            lines.append(f"  • {time_str} - {e.title}")
        return "\n".join(lines)


@tool
async def update_event(
    event_id: int,
    title: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    description: Optional[str] = None,
    remind_before: Optional[int] = None,
    repeat_rule: Optional[str] = None,
) -> str:
    """编辑日程事件。

    Args:
        event_id: 事件ID
        title: 新标题（可选）
        start_time: 新开始时间，格式：YYYY-MM-DD HH:MM（可选）
        end_time: 新结束时间，格式：YYYY-MM-DD HH:MM（可选）
        description: 新描述（可选）
        remind_before: 新提前提醒分钟数（可选）
        repeat_rule: 新重复规则（none/daily/weekly/monthly/yearly，可选）
    """
    account_id = current_account_id.get()

    async with async_session_factory() as session:
        event = await session.get(Event, event_id)
        if not event:
            return f"❌ 未找到事件 ID: {event_id}"

        # 权限检查：仅创建者可编辑
        if not account_id or event.created_by != account_id:
            return "❌ 无权编辑此事件"

        if title is not None:
            event.title = title
        if start_time is not None:
            event.start_time = datetime.strptime(start_time, "%Y-%m-%d %H:%M")
        if end_time and end_time.strip():
            event.end_time = datetime.strptime(end_time.strip(), "%Y-%m-%d %H:%M")
        elif end_time is not None:
            event.end_time = None  # 明确清除 end_time
        if description is not None:
            event.description = description
        if remind_before is not None:
            event.remind_before = remind_before
        if repeat_rule is not None:
            event.repeat_rule = repeat_rule

        event.updated_at = datetime.now(timezone.utc)
        await session.commit()
        return f"✅ 已更新事件「{event.title}」"


@tool
async def delete_event(event_id: int) -> str:
    """删除日程事件。

    Args:
        event_id: 事件ID
    """
    account_id = current_account_id.get()

    async with async_session_factory() as session:
        event = await session.get(Event, event_id)
        if not event:
            return f"❌ 未找到事件 ID: {event_id}"

        # 权限检查：仅创建者可删除
        if not account_id or event.created_by != account_id:
            return "❌ 无权删除此事件"

        await session.delete(event)
        await session.commit()
        return f"✅ 已删除事件「{event.title}」"


# ==================== 待办工具 ====================

@tool
async def add_todo(
    title: str,
    description: Optional[str] = None,
    due_date: Optional[str] = None,
    priority: str = "medium",
    scope: str = "shared",
) -> str:
    """添加待办事项。

    Args:
        title: 事项标题
        description: 描述（可选）
        due_date: 截止日期，格式：YYYY-MM-DD（可选）
        priority: 优先级（low/medium/high）
        scope: 可见范围（personal: 仅自己可见, shared: 组内共享，默认shared）
    """
    account_id = current_account_id.get()
    group_id = current_group_id.get()

    async with async_session_factory() as session:
        todo = Todo(
            title=title,
            description=description,
            due_date=datetime.strptime(due_date, "%Y-%m-%d").date() if due_date else None,
            priority=priority,
            scope=scope,
            created_by=account_id or "system",
            group_id=group_id if scope == "shared" else None,
        )
        session.add(todo)
        await session.commit()
        return f"✅ 已添加待办「{title}」"


@tool
async def list_todos(
    completed: bool = False,
) -> str:
    """查询待办事项。

    Args:
        completed: 是否显示已完成的事项，默认False
    """
    account_id = current_account_id.get()
    group_id = current_group_id.get()

    async with async_session_factory() as session:
        query = select(Todo)

        # 按用户组过滤：组内共享 + 自己创建的（含个人）
        if group_id is not None:
            query = query.where(or_(
                Todo.group_id == group_id,
                Todo.created_by == account_id,
            ))
        elif account_id:
            query = query.where(Todo.created_by == account_id)

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
        result = await session.execute(query)
        todos = result.scalars().all()

        if not todos:
            return "📝 暂无待办事项"

        lines = ["📝 待办事项："]
        for t in todos:
            status = "✅" if t.completed else "⬜"
            priority = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(t.priority, "⚪")
            due = f" (截止: {t.due_date})" if t.due_date else ""
            lines.append(f"  {status} {priority} {t.title}{due}")
        return "\n".join(lines)


@tool
async def update_todo(
    todo_id: int,
    title: Optional[str] = None,
    description: Optional[str] = None,
    due_date: Optional[str] = None,
    priority: Optional[str] = None,
    scope: Optional[str] = None,
) -> str:
    """编辑待办事项。

    Args:
        todo_id: 待办事项ID
        title: 新标题（可选）
        description: 新描述（可选）
        due_date: 新截止日期，格式：YYYY-MM-DD（可选）
        priority: 新优先级（low/medium/high，可选）
        scope: 新可见范围（personal: 仅自己可见, shared: 组内共享，可选）
    """
    account_id = current_account_id.get()
    group_id = current_group_id.get()

    async with async_session_factory() as session:
        todo = await session.get(Todo, todo_id)
        if not todo:
            return f"❌ 未找到待办 ID: {todo_id}"

        # 权限检查：仅创建者或管理员可编辑
        is_owner = account_id and todo.created_by == account_id
        is_admin = current_is_admin.get()
        if not is_owner and not is_admin:
            return "❌ 无权编辑此待办"

        if title is not None:
            todo.title = title
        if description is not None:
            todo.description = description
        if due_date is not None:
            todo.due_date = datetime.strptime(due_date, "%Y-%m-%d").date() if due_date else None
        if priority is not None:
            todo.priority = priority
        if scope is not None:
            todo.scope = scope
            todo.group_id = group_id if scope == "shared" else None

        await session.commit()
        return f"✅ 已更新待办「{todo.title}」"


@tool
async def complete_todo(todo_id: int) -> str:
    """完成待办事项。

    Args:
        todo_id: 待办事项ID
    """
    account_id = current_account_id.get()
    group_id = current_group_id.get()

    async with async_session_factory() as session:
        todo = await session.get(Todo, todo_id)
        if not todo:
            return f"❌ 未找到待办 ID: {todo_id}"

        # 权限检查：创建者、管理员，或同组成员可操作共享待办
        is_owner = account_id and todo.created_by == account_id
        is_admin = current_is_admin.get()
        is_same_group = (
            todo.scope == "shared"
            and todo.group_id is not None
            and group_id is not None
            and todo.group_id == group_id
        )
        if not is_owner and not is_admin and not is_same_group:
            return "❌ 无权操作此待办"

        todo.completed = True
        todo.completed_at = datetime.now(timezone.utc)
        await session.commit()
        return f"✅ 已完成「{todo.title}」"


@tool
async def restore_todo(todo_id: int) -> str:
    """恢复已归档的待办事项（将已完成的事项恢复为未完成）。

    Args:
        todo_id: 待办事项ID
    """
    account_id = current_account_id.get()
    group_id = current_group_id.get()

    async with async_session_factory() as session:
        todo = await session.get(Todo, todo_id)
        if not todo:
            return f"❌ 未找到待办 ID: {todo_id}"

        # 权限检查：创建者、管理员，或同组成员可操作共享待办
        is_owner = account_id and todo.created_by == account_id
        is_admin = current_is_admin.get()
        is_same_group = (
            todo.scope == "shared"
            and todo.group_id is not None
            and group_id is not None
            and todo.group_id == group_id
        )
        if not is_owner and not is_admin and not is_same_group:
            return "❌ 无权操作此待办"

        todo.completed = False
        todo.completed_at = None
        await session.commit()
        return f"🔄 已恢复「{todo.title}」为未完成"


@tool
async def delete_todo(todo_id: int) -> str:
    """删除待办事项。

    Args:
        todo_id: 待办事项ID
    """
    account_id = current_account_id.get()
    group_id = current_group_id.get()

    async with async_session_factory() as session:
        todo = await session.get(Todo, todo_id)
        if not todo:
            return f"❌ 未找到待办 ID: {todo_id}"

        # 权限检查：仅创建者或管理员可删除
        is_owner = account_id and todo.created_by == account_id
        is_admin = current_is_admin.get()
        if not is_owner and not is_admin:
            return "❌ 无权删除此待办"

        todo.deleted = True
        await session.commit()
        return f"✅ 已删除待办「{todo.title}」"


# ==================== 快递工具 ====================

@tool
async def add_package(
    tracking_number: str,
    item_name: str,
    scope: str = "shared",
    phone_last4: Optional[str] = None,
) -> str:
    """添加快递包裹，自动识别快递公司并查询最新状态。

    Args:
        tracking_number: 快递单号
        item_name: 物品名称/描述
        scope: 可见范围（personal: 仅自己可见, shared: 组内共享，默认shared）
        phone_last4: 手机号后四位（可选，部分快递公司查询需要）
    """
    account_id = current_account_id.get()
    group_id = current_group_id.get()

    async with async_session_factory() as session:
        # 检查是否已存在
        existing = await session.execute(
            select(Package).where(Package.tracking_number == tracking_number)
        )
        if existing.scalar_one_or_none():
            return f"❌ 快递单号 {tracking_number} 已存在"

        # 确定手机号后四位：优先使用传入值，否则从账户获取
        if not phone_last4 and account_id:
            account = await session.get(Account, int(account_id))
            if account and account.phone and len(account.phone) >= 4:
                phone_last4 = account.phone[-4:]

        # 识别快递公司
        carrier_code, carrier_name = await detect_carrier(tracking_number)

        # 查询初始状态
        tracking_data = await refresh_package_status(carrier_code, tracking_number, phone_last4)

        package = Package(
            tracking_number=tracking_number,
            item_name=item_name,
            phone_last4=phone_last4,
            carrier_code=carrier_code,
            carrier_name=carrier_name,
            status=tracking_data["status"],
            last_update=tracking_data["last_update"],
            tracking_info=json.dumps(tracking_data["tracking_info"], ensure_ascii=False),
            scope=scope,
            created_by=account_id or "system",
            group_id=group_id if scope == "shared" else None,
        )
        session.add(package)
        await session.commit()
        return f"📦 已添加快递「{item_name}」\n  单号：{tracking_number}\n  快递公司：{carrier_name}\n  当前状态：{tracking_data['status']}"


@tool
async def list_packages(show_all: bool = False) -> str:
    """查询快递包裹列表。

    Args:
        show_all: 是否显示所有快递（包括已签收），默认只显示未签收的
    """
    account_id = current_account_id.get()
    group_id = current_group_id.get()

    async with async_session_factory() as session:
        query = select(Package)

        # 按用户组过滤：组内共享 + 自己创建的（含个人）
        if group_id is not None:
            query = query.where(or_(
                Package.group_id == group_id,
                Package.created_by == account_id,
            ))
        elif account_id:
            query = query.where(Package.created_by == account_id)

        if not show_all:
            query = query.where(Package.status.notin_(["已签收"]))
        query = query.order_by(Package.created_at.desc())
        result = await session.execute(query)
        packages = result.scalars().all()

        if not packages:
            return "📦 暂无快递"

        status_emoji = {
            "未发货": "📤",
            "运输中": "🚚",
            "派送中": "📬",
            "已签收": "✅",
            "查询失败": "⚠️",
        }

        lines = ["📦 快递列表："]
        for p in packages:
            emoji = status_emoji.get(p.status, "📦")
            carrier = f" ({p.carrier_name})" if p.carrier_name else ""
            lines.append(f"  {emoji} [{p.id}] {p.item_name} - {p.tracking_number}{carrier} - {p.status}")
        return "\n".join(lines)


@tool
async def refresh_package(package_id: int) -> str:
    """手动刷新快递状态。

    Args:
        package_id: 快递ID
    """
    account_id = current_account_id.get()
    group_id = current_group_id.get()

    async with async_session_factory() as session:
        package = await session.get(Package, package_id)
        if not package:
            return f"❌ 未找到快递 ID: {package_id}"

        # 权限检查：仅创建者或管理员可操作
        is_owner = account_id and package.created_by == account_id
        is_admin = current_is_admin.get()
        if not is_owner and not is_admin:
            return "❌ 无权操作此快递"

        data = await refresh_package_status(package.carrier_code or "unknown", package.tracking_number, package.phone_last4)
        package.status = data["status"]
        package.last_update = data["last_update"]
        package.tracking_info = json.dumps(data["tracking_info"], ensure_ascii=False)
        package.updated_at = datetime.now(timezone.utc)
        await session.commit()

        return f"📦 已刷新「{package.item_name}」\n  当前状态：{data['status']}\n  最新信息：{data['last_update']}"


@tool
async def update_package(
    package_id: int,
    tracking_number: Optional[str] = None,
    item_name: Optional[str] = None,
    scope: Optional[str] = None,
) -> str:
    """修改快递记录信息。修改单号后会自动重新识别快递公司并刷新物流。

    Args:
        package_id: 快递ID
        tracking_number: 新的快递单号（可选）
        item_name: 新的物品名称（可选）
        scope: 新的可见范围（personal: 仅自己可见, shared: 组内共享，可选）
    """
    account_id = current_account_id.get()
    group_id = current_group_id.get()

    async with async_session_factory() as session:
        package = await session.get(Package, package_id)
        if not package:
            return f"❌ 未找到快递 ID: {package_id}"

        # 权限检查：仅创建者或管理员可修改
        is_owner = account_id and package.created_by == account_id
        is_admin = current_is_admin.get()
        if not is_owner and not is_admin:
            return "❌ 无权修改此快递"

        old_name = package.item_name
        old_number = package.tracking_number

        if tracking_number and tracking_number != package.tracking_number:
            # 检查新单号是否已存在
            existing = await session.execute(
                select(Package).where(
                    Package.tracking_number == tracking_number,
                    Package.id != package_id,
                )
            )
            if existing.scalar_one_or_none():
                return f"❌ 快递单号 {tracking_number} 已存在"
            package.tracking_number = tracking_number
            # 重新识别快递公司并刷新状态
            carrier_code, carrier_name = await detect_carrier(tracking_number)
            package.carrier_code = carrier_code
            package.carrier_name = carrier_name
            tracking_data = await refresh_package_status(carrier_code, tracking_number, package.phone_last4)
            package.status = tracking_data["status"]
            package.last_update = tracking_data["last_update"]
            package.tracking_info = json.dumps(tracking_data["tracking_info"], ensure_ascii=False)

        if item_name is not None:
            package.item_name = item_name
        if scope is not None:
            package.scope = scope
            package.group_id = group_id if scope == "shared" else None

        package.updated_at = datetime.now(timezone.utc)
        await session.commit()

        changes = []
        if old_name != package.item_name:
            changes.append(f"名称: {old_name} → {package.item_name}")
        if old_number != package.tracking_number:
            changes.append(f"单号: {old_number} → {package.tracking_number}")

        return f"✅ 已修改快递「{package.item_name}」\n  " + "\n  ".join(changes) if changes else f"✅ 快递「{package.item_name}」无变更"


@tool
async def delete_package(package_id: int) -> str:
    """删除快递记录。

    Args:
        package_id: 快递ID
    """
    account_id = current_account_id.get()
    group_id = current_group_id.get()

    async with async_session_factory() as session:
        package = await session.get(Package, package_id)
        if not package:
            return f"❌ 未找到快递 ID: {package_id}"

        # 权限检查：仅创建者或管理员可删除
        is_owner = account_id and package.created_by == account_id
        is_admin = current_is_admin.get()
        if not is_owner and not is_admin:
            return "❌ 无权删除此快递"

        name = package.item_name
        number = package.tracking_number
        await session.delete(package)
        await session.commit()
        return f"✅ 已删除快递「{name}」({number})"



# ==================== 纪念日工具 ====================

@tool
async def add_anniversary(
    title: str,
    date: str,
    description: Optional[str] = None,
    repeat_rule: str = "yearly",
    scope: str = "shared",
) -> str:
    """添加纪念日。
    Args:
        title: 纪念日名称
        date: 日期，格式：YYYY-MM-DD
        description: 描述（可选）
        repeat_rule: 重复规则（yearly/none）
        scope: 可见范围（personal: 仅自己可见, shared: 组内共享，默认shared）
    """
    account_id = current_account_id.get()
    group_id = current_group_id.get()

    async with async_session_factory() as session:
        anniversary = Anniversary(
            title=title,
            description=description,
            date=datetime.strptime(date, "%Y-%m-%d").date(),
            repeat_rule=repeat_rule,
            scope=scope,
            created_by=account_id or "system",
            group_id=group_id if scope == "shared" else None,
        )
        session.add(anniversary)
        await session.commit()
        return f"✅ 已添加纪念日「{title}」，日期：{date}"


@tool
async def list_anniversaries() -> str:
    """查询纪念日列表。"""
    account_id = current_account_id.get()
    group_id = current_group_id.get()

    async with async_session_factory() as session:
        query = select(Anniversary)

        if group_id is not None:
            query = query.where(or_(
                Anniversary.group_id == group_id,
                Anniversary.created_by == account_id,
            ))
        elif account_id:
            query = query.where(Anniversary.created_by == account_id)

        query = query.order_by(Anniversary.date)
        result = await session.execute(query)
        anniversaries = result.scalars().all()

        if not anniversaries:
            return "🎂 暂无纪念日"

        today = date.today()
        lines = ["🎂 纪念日列表："]
        for a in anniversaries:
            d = a.date
            this_year = d.replace(year=today.year)
            if this_year < today:
                next_date = d.replace(year=today.year + 1)
            else:
                next_date = this_year
            days_until = (next_date - today).days
            repeat = "每年" if a.repeat_rule == "yearly" else ""
            lines.append(f"  🎉 [{a.id}] {a.title} - {d} ({repeat}) 还有{days_until}天")
        return "\n".join(lines)


@tool
async def delete_anniversary(anniversary_id: int) -> str:
    """删除纪念日。
    Args:
        anniversary_id: 纪念日ID
    """
    account_id = current_account_id.get()
    group_id = current_group_id.get()

    async with async_session_factory() as session:
        anniversary = await session.get(Anniversary, anniversary_id)
        if not anniversary:
            return f"❌ 未找到纪念日 ID: {anniversary_id}"

        # 权限检查：仅创建者或管理员可删除
        is_owner = account_id and anniversary.created_by == account_id
        is_admin = current_is_admin.get()
        if not is_owner and not is_admin:
            return "❌ 无权删除此纪念日"

        await session.delete(anniversary)
        await session.commit()
        return f"✅ 已删除纪念日「{anniversary.title}」"


# ==================== 工作日志工具 ====================

@tool
async def add_work_log(
    content: str,
    log_date: Optional[str] = None,
) -> str:
    """记录工作内容到工作日志。同一天的内容会自动合并到一条日志中。当用户发送工作相关内容时自动调用。

    Args:
        content: 工作内容描述
        log_date: 日志日期，格式：YYYY-MM-DD（可选，默认今天）
    """
    account_id = current_account_id.get()
    target_date = datetime.strptime(log_date, "%Y-%m-%d").date() if log_date else date.today()
    now = datetime.now(timezone.utc)

    async with async_session_factory() as session:
        # 查询当天的日志
        query = select(WorkLog).where(
            WorkLog.created_by == (account_id or "system"),
            WorkLog.log_date == target_date,
        )
        result = await session.execute(query)
        work_log = result.scalar_one_or_none()

        if work_log:
            # 追加内容到现有日志
            try:
                contents = json.loads(work_log.content)
            except (json.JSONDecodeError, TypeError):
                contents = [{"content": work_log.content, "added_at": work_log.created_at.isoformat()}]

            contents.append({
                "content": content,
                "added_at": now.isoformat(),
            })
            work_log.content = json.dumps(contents, ensure_ascii=False)
            work_log.updated_at = now
        else:
            # 创建新的日志
            contents = [{
                "content": content,
                "added_at": now.isoformat(),
            }]
            work_log = WorkLog(
                content=json.dumps(contents, ensure_ascii=False),
                log_date=target_date,
                created_by=account_id or "system",
                group_id=None,
            )
            session.add(work_log)

        await session.commit()
        return f"✅ 已记录工作日志「{content[:30]}...」到 {target_date}"


@tool
async def list_work_logs(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 20,
) -> str:
    """查询工作日志列表。

    Args:
        start_date: 开始日期，格式：YYYY-MM-DD（可选，默认7天前）
        end_date: 结束日期，格式：YYYY-MM-DD（可选，默认今天）
        limit: 返回条数，默认20
    """
    account_id = current_account_id.get()

    async with async_session_factory() as session:
        query = select(WorkLog)

        # 个人独占：始终按创建者过滤
        query = query.where(WorkLog.created_by == (account_id or "system"))

        # 日期过滤
        if start_date:
            start = datetime.strptime(start_date, "%Y-%m-%d").date()
        else:
            start = date.today() - timedelta(days=7)

        if end_date:
            end = datetime.strptime(end_date, "%Y-%m-%d").date()
        else:
            end = date.today()

        query = query.where(WorkLog.log_date >= start, WorkLog.log_date <= end)
        query = query.order_by(WorkLog.log_date.desc()).limit(limit)

        result = await session.execute(query)
        logs = result.scalars().all()

        if not logs:
            return "📋 暂无工作日志"

        lines = [f"📋 工作日志 ({start} ~ {end})："]
        for log in logs:
            date_str = log.log_date.strftime("%m-%d")
            try:
                contents = json.loads(log.content)
                content_count = len(contents)
                first_content = contents[0]["content"][:30] if contents else ""
            except (json.JSONDecodeError, TypeError):
                content_count = 1
                first_content = log.content[:30]
            lines.append(f"  • [{date_str}] {content_count}条记录 - {first_content}...")
        return "\n".join(lines)


@tool
async def summarize_work_logs(period: str = "week") -> str:
    """总结工作日志，用于向公司汇报。

    Args:
        period: 总结周期 - "week"（本周）或 "month"（本月）
    """
    account_id = current_account_id.get()

    async with async_session_factory() as session:
        today = date.today()

        if period == "week":
            # 本周（周一到周日）
            weekday = today.weekday()
            start = today - timedelta(days=weekday)
            end = start + timedelta(days=6)
            period_name = "本周"
        else:
            # 本月
            start = today.replace(day=1)
            if today.month == 12:
                end = date(today.year + 1, 1, 1) - timedelta(days=1)
            else:
                end = date(today.year, today.month + 1, 1) - timedelta(days=1)
            period_name = "本月"

        query = select(WorkLog).where(
            WorkLog.created_by == (account_id or "system"),
            WorkLog.log_date >= start,
            WorkLog.log_date <= end,
        ).order_by(WorkLog.log_date)

        result = await session.execute(query)
        logs = result.scalars().all()

        if not logs:
            return f"📋 {period_name}暂无工作日志"

        import json
        # 按日期分组
        logs_by_date = {}
        total_items = 0
        for log in logs:
            date_str = log.log_date.strftime("%m月%d日")
            if date_str not in logs_by_date:
                logs_by_date[date_str] = []
            try:
                contents = json.loads(log.content)
                for item in contents:
                    logs_by_date[date_str].append(item["content"])
                    total_items += 1
            except (json.JSONDecodeError, TypeError):
                logs_by_date[date_str].append(log.content)
                total_items += 1

        lines = [f"📋 {period_name}工作总结 ({start} ~ {end})：", ""]
        for date_str, items in logs_by_date.items():
            lines.append(f"【{date_str}】")
            for item in items:
                lines.append(f"  • {item}")
            lines.append("")

        lines.append(f"共记录 {total_items} 条工作内容，分布在 {len(logs)} 天")
        return "\n".join(lines)


# ==================== 记忆工具 ====================

@tool
async def save_memory(
    content: str,
    category: str = "user_fact",
    keywords: Optional[str] = None,
) -> str:
    """保存一条长期记忆。当用户提到值得长期记住的信息时调用。

    Args:
        content: 记忆内容，一条简洁的事实，如"主人喜欢喝美式咖啡"
        category: 类型 (user_fact: 用户偏好/事实, important_date: 重要日期, decision: 决定, habit: 习惯)
        keywords: 关键词，逗号分隔，用于后续检索，如"咖啡,偏好,饮品"
    """
    account_id = current_account_id.get()
    group_id = current_group_id.get()

    async with async_session_factory() as session:
        memory = Memory(
            content=content,
            category=category,
            keywords=keywords,
            account_id=int(account_id) if account_id and account_id.isdigit() else 0,
            group_id=group_id,
        )
        session.add(memory)
        await session.commit()
        return f"🧠 已记住：「{content}」"


@tool
async def recall_memory(query: str) -> str:
    """检索与查询相关的长期记忆。

    Args:
        query: 搜索关键词
    """
    account_id_str = current_account_id.get()
    group_id = current_group_id.get()

    async with async_session_factory() as session:
        stmt = select(Memory)

        # 将 context var 中的字符串 account_id 转为 int 用于 Memory 查询
        account_id_int = int(account_id_str) if account_id_str and account_id_str.isdigit() else None

        if group_id is not None:
            stmt = stmt.where(or_(
                Memory.group_id == group_id,
                Memory.account_id == account_id_int,
            ))
        elif account_id_int is not None:
            stmt = stmt.where(Memory.account_id == account_id_int)

        # 按内容和关键词搜索
        stmt = stmt.where(or_(
            Memory.content.ilike(f"%{query}%"),
            Memory.keywords.ilike(f"%{query}%"),
        ))
        stmt = stmt.order_by(Memory.created_at.desc()).limit(10)

        result = await session.execute(stmt)
        memories = result.scalars().all()

        if not memories:
            return "🔍 未找到相关记忆"

        # 更新 last_used_at
        from datetime import datetime
        for m in memories:
            m.last_used_at = datetime.now(timezone.utc)
        await session.commit()

        lines = ["🧠 相关记忆："]
        category_labels = {
            "user_fact": "📌", "important_date": "📅",
            "decision": "📌", "habit": "🔄",
        }
        for m in memories:
            emoji = category_labels.get(m.category, "📝")
            lines.append(f"  {emoji} [{m.id}] {m.content}")
        return "\n".join(lines)


@tool
async def delete_memory(memory_id: int) -> str:
    """删除一条长期记忆。

    Args:
        memory_id: 记忆ID
    """
    account_id_str = current_account_id.get()

    async with async_session_factory() as session:
        memory = await session.get(Memory, memory_id)
        if not memory:
            return f"❌ 未找到记忆 ID: {memory_id}"

        account_id_int = int(account_id_str) if account_id_str and account_id_str.isdigit() else None
        if memory.account_id != account_id_int:
            return "❌ 无权删除此记忆"

        content = memory.content
        await session.delete(memory)
        await session.commit()
        return f"🗑️ 已删除记忆「{content}」"


# ==================== 查询工具 ====================

@tool
def get_current_time() -> str:
    """获取当前时间"""
    now = datetime.now()
    return f"🕐 当前时间：{now.strftime('%Y-%m-%d %H:%M:%S')} ({now.strftime('%A')})"


@tool
def calculate(expression: str) -> str:
    """计算数学表达式。

    Args:
        expression: 数学表达式，如 "1 + 2 * 3"
    """
    try:
        # 安全的数学计算
        allowed_chars = set("0123456789+-*/.() ")
        if not all(c in allowed_chars for c in expression):
            return "❌ 表达式包含不允许的字符"
        result = eval(expression)
        return f"🔢 计算结果：{expression} = {result}"
    except Exception as e:
        return f"❌ 计算错误：{str(e)}"


# ==================== 工具集合 ====================

def get_all_tools():
    """获取所有工具"""
    return [
        # 日程工具
        create_event,
        list_events,
        update_event,
        delete_event,
        # 待办工具
        add_todo,
        list_todos,
        update_todo,
        complete_todo,
        restore_todo,
        delete_todo,
        # 快递工具
        add_package,
        list_packages,
        refresh_package,
        update_package,
        delete_package,
        # 纪念日工具
        add_anniversary,
        list_anniversaries,
        delete_anniversary,
        # 工作日志工具
        add_work_log,
        list_work_logs,
        summarize_work_logs,
        # 记忆工具
        save_memory,
        recall_memory,
        delete_memory,
        # 查询工具
        get_current_time,
        calculate,
    ]
