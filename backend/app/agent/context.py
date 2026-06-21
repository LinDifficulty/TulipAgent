"""Agent 上下文 - 通过 contextvars 向工具传递账户信息"""
from contextvars import ContextVar

# 当前账户信息，由 chat router 在调用 agent 前设置
current_account_id: ContextVar[str | None] = ContextVar("current_account_id", default=None)
current_group_id: ContextVar[int | None] = ContextVar("current_group_id", default=None)
current_is_admin: ContextVar[bool] = ContextVar("current_is_admin", default=False)
