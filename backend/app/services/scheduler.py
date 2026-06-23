"""定时任务调度器 - 自动刷新快递状态"""
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select, update

from ..database import async_session_factory
from ..models import Package
from .package_service import refresh_package_status

logger = logging.getLogger(__name__)

# 全局调度器实例
scheduler = AsyncIOScheduler(timezone="Asia/Shanghai")


async def refresh_all_packages():
    """刷新所有未签收的快递状态"""
    async with async_session_factory() as session:
        # 查询所有未签收的快递
        query = select(Package).where(
            Package.status.notin_(["已签收", "查询失败"])
        )
        result = await session.execute(query)
        packages = result.scalars().all()

        if not packages:
            logger.info("没有需要刷新的快递")
            return

        logger.info(f"开始刷新 {len(packages)} 个快递的状态...")

        refreshed = 0
        for pkg in packages:
            try:
                data = await refresh_package_status(pkg.carrier_code or "unknown", pkg.tracking_number, pkg.phone_last4)
                pkg.status = data["status"]
                pkg.last_update = data["last_update"]
                pkg.tracking_info = __import__("json").dumps(data["tracking_info"], ensure_ascii=False)
                pkg.updated_at = datetime.now(timezone.utc)
                refreshed += 1
            except Exception as e:
                logger.error(f"刷新快递 {pkg.tracking_number} 失败: {e}")

        await session.commit()
        logger.info(f"快递状态刷新完成，成功 {refreshed}/{len(packages)}")


def start_scheduler():
    """启动定时任务调度器"""
    if scheduler.running:
        return

    # 每30分钟刷新一次快递状态
    scheduler.add_job(
        refresh_all_packages,
        trigger=IntervalTrigger(minutes=30),
        id="refresh_packages",
        name="刷新快递状态",
        replace_existing=True,
        next_run_time=None,  # 不立即运行，等下次触发
    )

    scheduler.start()
    logger.info("定时任务调度器已启动，每30分钟自动刷新快递状态")


def stop_scheduler():
    """停止定时任务调度器"""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("定时任务调度器已停止")
