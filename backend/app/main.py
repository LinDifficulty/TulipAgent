"""FastAPI 应用入口"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings, ensure_data_dirs
from .database import init_db, close_db, async_session_factory
from .routers import chat_router, events_router, todos_router, packages_router, anniversaries_router, work_logs_router, llm_router, auth_router, admin_router, memory_router
from .services.scheduler import start_scheduler, stop_scheduler
from .models.account import Account
from .models.group import UserGroup


async def ensure_default_admin():
    """确保默认管理员账号存在"""
    from sqlalchemy import select
    async with async_session_factory() as session:
        # 检查是否已有 admin 账号
        result = await session.execute(select(Account).where(Account.role == "admin"))
        if result.scalar_one_or_none() is not None:
            return

        # 创建默认管理员
        admin = Account(
            token="admin",
            nickname="管理员",
            role="admin",
            is_active=True,
        )
        session.add(admin)
        await session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时
    ensure_data_dirs()
    await init_db()
    await ensure_default_admin()
    start_scheduler()
    yield
    # 关闭时
    stop_scheduler()
    await close_db()


def create_app() -> FastAPI:
    """创建 FastAPI 应用"""
    settings = get_settings()

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="个人AI助理 - 两人共用的智能助手",
        lifespan=lifespan,
    )

    # CORS 配置
    # 注意: allow_credentials=True 时 allow_origins 不能为 ["*"]，
    # 必须指定明确的来源列表（浏览器 CORS 规范限制）
    cors_origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 注册路由
    app.include_router(auth_router)
    app.include_router(admin_router)
    app.include_router(chat_router)
    app.include_router(events_router)
    app.include_router(todos_router)
    app.include_router(packages_router)
    app.include_router(anniversaries_router)
    app.include_router(work_logs_router)
    app.include_router(llm_router)
    app.include_router(memory_router)

    # 健康检查
    @app.get("/")
    async def root():
        return {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "status": "running",
        }

    @app.get("/health")
    async def health():
        return {"status": "healthy"}

    return app


# 创建应用实例
app = create_app()
