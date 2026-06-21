"""数据库配置"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from .config import get_settings

settings = get_settings()

# 创建异步引擎
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True,
)

# 创建异步会话工厂
async_session_factory = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """ORM 基类"""
    pass


async def get_db() -> AsyncSession:
    """获取数据库会话"""
    async with async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """初始化数据库（含自动迁移）"""
    async with engine.begin() as conn:
        # 创建新表
        await conn.run_sync(Base.metadata.create_all)
        # 自动迁移：给已有表添加 group_id 列
        from sqlalchemy import text
        for table in ("events", "todos", "packages"):
            try:
                await conn.execute(
                    text(f"ALTER TABLE {table} ADD COLUMN group_id INTEGER REFERENCES user_groups(id)")
                )
            except Exception:
                pass  # 列已存在则忽略
        # 自动迁移：给 accounts 表添加 phone 列
        try:
            await conn.execute(
                text("ALTER TABLE accounts ADD COLUMN phone VARCHAR(20)")
            )
        except Exception:
            pass  # 列已存在则忽略
        # 自动迁移：给 packages 表添加 phone_last4 列
        try:
            await conn.execute(
                text("ALTER TABLE packages ADD COLUMN phone_last4 VARCHAR(4)")
            )
        except Exception:
            pass  # 列已存在则忽略
        # 自动迁移：给 todos 表添加 deleted 列（软删除）
        try:
            await conn.execute(
                text("ALTER TABLE todos ADD COLUMN deleted BOOLEAN DEFAULT 0 NOT NULL")
            )
        except Exception:
            pass  # 列已存在则忽略


async def close_db():
    """关闭数据库连接"""
    await engine.dispose()
