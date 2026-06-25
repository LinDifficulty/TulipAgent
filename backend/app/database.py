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
        # 自动迁移：将 memories 表的 account_id 从 VARCHAR 改为 INTEGER（SQLite 通过重建表实现）
        try:
            # 检查列类型是否需要迁移
            info_result = await conn.execute(text("PRAGMA table_info(memories)"))
            columns = {row[1]: row[2] for row in info_result.fetchall()}
            if columns.get("account_id", "").upper() not in ("INTEGER", "INT"):
                # 重建表以修改列类型
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS memories_new (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        content TEXT NOT NULL,
                        category VARCHAR(30) NOT NULL DEFAULT 'user_fact',
                        keywords TEXT,
                        account_id INTEGER NOT NULL REFERENCES accounts(id),
                        group_id INTEGER REFERENCES user_groups(id),
                        created_at DATETIME,
                        last_used_at DATETIME
                    )
                """))
                await conn.execute(text("""
                    INSERT INTO memories_new (id, content, category, keywords, account_id, group_id, created_at, last_used_at)
                    SELECT id, content, category, keywords, CAST(account_id AS INTEGER), group_id, created_at, last_used_at
                    FROM memories
                """))
                await conn.execute(text("DROP TABLE memories"))
                await conn.execute(text("ALTER TABLE memories_new RENAME TO memories"))
        except Exception:
            pass  # 迁移失败不影响启动


async def close_db():
    """关闭数据库连接"""
    await engine.dispose()
