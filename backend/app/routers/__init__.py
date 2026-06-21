"""API 路由"""
from .chat import router as chat_router
from .events import router as events_router
from .todos import router as todos_router
from .packages import router as packages_router
from .anniversaries import router as anniversaries_router
from .work_logs import router as work_logs_router
from .llm import router as llm_router
from .auth import router as auth_router
from .admin import router as admin_router
from .memory import router as memory_router

__all__ = [
    "chat_router",
    "events_router",
    "todos_router",
    "packages_router",
    "anniversaries_router",
    "work_logs_router",
    "llm_router",
    "auth_router",
    "admin_router",
    "memory_router",
]
