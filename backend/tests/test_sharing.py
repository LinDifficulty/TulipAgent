"""共享功能测试 - 验证组内共享和个人待办的可见性"""
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import Base, get_db
from backend.app.main import app
from backend.app.models.account import Account
from backend.app.models.group import UserGroup
from backend.app.models.todo import Todo


@pytest.fixture
async def setup_accounts(db_session: AsyncSession):
    """创建测试账户和用户组"""
    # 创建用户组
    group = UserGroup(id=1, name="测试组", description="测试用组")
    db_session.add(group)

    # 创建两个同组用户
    account1 = Account(id=1, token="token_user1", nickname="用户1", role="admin", group_id=1)
    account2 = Account(id=2, token="token_user2", nickname="用户2", role="user", group_id=1)
    # 创建一个无组用户
    account3 = Account(id=3, token="token_user3", nickname="用户3", role="user", group_id=None)

    db_session.add_all([account1, account2, account3])
    await db_session.commit()

    return {"group": group, "user1": account1, "user2": account2, "user3": account3}


@pytest.fixture
async def client_with_auth(db_session: AsyncSession):
    """获取带认证的测试客户端"""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


# ==================== REST API 共享测试 ====================


@pytest.mark.asyncio
async def test_shared_todo_visible_to_group_member(client_with_auth: AsyncClient, setup_accounts):
    """测试：共享待办对同组成员可见"""
    client = client_with_auth

    # user1 创建一个共享待办
    resp = await client.post(
        "/api/todos/",
        json={"title": "买牛奶", "scope": "shared"},
        headers={"Authorization": "Bearer token_user1"},
    )
    assert resp.status_code == 200
    todo = resp.json()
    assert todo["scope"] == "shared"
    assert todo["title"] == "买牛奶"

    # user2 (同组) 应该能看到
    resp = await client.get(
        "/api/todos/",
        headers={"Authorization": "Bearer token_user2"},
    )
    assert resp.status_code == 200
    todos = resp.json()
    assert any(t["title"] == "买牛奶" for t in todos), \
        f"user2 应该能看到 user1 的共享待办，但列表为: {todos}"


@pytest.mark.asyncio
async def test_personal_todo_not_visible_to_other(client_with_auth: AsyncClient, setup_accounts):
    """测试：个人待办对同组其他成员不可见"""
    client = client_with_auth

    # user1 创建一个个人待办
    resp = await client.post(
        "/api/todos/",
        json={"title": "个人秘密", "scope": "personal"},
        headers={"Authorization": "Bearer token_user1"},
    )
    assert resp.status_code == 200
    assert resp.json()["scope"] == "personal"

    # user2 (同组) 不应该能看到
    resp = await client.get(
        "/api/todos/",
        headers={"Authorization": "Bearer token_user2"},
    )
    assert resp.status_code == 200
    todos = resp.json()
    assert not any(t["title"] == "个人秘密" for t in todos), \
        f"user2 不应该能看到 user1 的个人待办，但列表为: {todos}"


@pytest.mark.asyncio
async def test_personal_todo_visible_to_creator(client_with_auth: AsyncClient, setup_accounts):
    """测试：个人待办对创建者自己可见"""
    client = client_with_auth

    # user1 创建个人待办
    await client.post(
        "/api/todos/",
        json={"title": "我的个人待办", "scope": "personal"},
        headers={"Authorization": "Bearer token_user1"},
    )

    # user1 自己能看到
    resp = await client.get(
        "/api/todos/",
        headers={"Authorization": "Bearer token_user1"},
    )
    assert resp.status_code == 200
    todos = resp.json()
    assert any(t["title"] == "我的个人待办" for t in todos)


@pytest.mark.asyncio
async def test_user_without_group_only_sees_own_todos(client_with_auth: AsyncClient, setup_accounts):
    """测试：无组用户只能看到自己的待办"""
    client = client_with_auth

    # user1 创建共享待办
    await client.post(
        "/api/todos/",
        json={"title": "组内共享", "scope": "shared"},
        headers={"Authorization": "Bearer token_user1"},
    )

    # user3 (无组) 不应该能看到
    resp = await client.get(
        "/api/todos/",
        headers={"Authorization": "Bearer token_user3"},
    )
    assert resp.status_code == 200
    todos = resp.json()
    assert not any(t["title"] == "组内共享" for t in todos), \
        f"无组用户不应看到共享待办，但列表为: {todos}"


@pytest.mark.asyncio
async def test_update_scope_shared_to_personal(client_with_auth: AsyncClient, setup_accounts):
    """测试：通过 REST API 将共享待办改为个人"""
    client = client_with_auth

    # user1 创建共享待办
    resp = await client.post(
        "/api/todos/",
        json={"title": "待转换", "scope": "shared"},
        headers={"Authorization": "Bearer token_user1"},
    )
    todo_id = resp.json()["id"]

    # user2 能看到（共享中）
    resp = await client.get(
        "/api/todos/",
        headers={"Authorization": "Bearer token_user2"},
    )
    assert any(t["id"] == todo_id for t in resp.json())

    # user1 将其改为个人
    resp = await client.put(
        f"/api/todos/{todo_id}",
        json={"scope": "personal"},
        headers={"Authorization": "Bearer token_user1"},
    )
    assert resp.status_code == 200
    assert resp.json()["scope"] == "personal"

    # user2 现在不应该看到了
    resp = await client.get(
        "/api/todos/",
        headers={"Authorization": "Bearer token_user2"},
    )
    assert not any(t["id"] == todo_id for t in resp.json()), \
        "改为个人后，同组成员不应再看到该待办"


@pytest.mark.asyncio
async def test_update_scope_personal_to_shared(client_with_auth: AsyncClient, setup_accounts):
    """测试：通过 REST API 将个人待办改为共享"""
    client = client_with_auth

    # user1 创建个人待办
    resp = await client.post(
        "/api/todos/",
        json={"title": "待共享", "scope": "personal"},
        headers={"Authorization": "Bearer token_user1"},
    )
    todo_id = resp.json()["id"]

    # user2 看不到（个人中）
    resp = await client.get(
        "/api/todos/",
        headers={"Authorization": "Bearer token_user2"},
    )
    assert not any(t["id"] == todo_id for t in resp.json())

    # user1 将其改为共享
    resp = await client.put(
        f"/api/todos/{todo_id}",
        json={"scope": "shared"},
        headers={"Authorization": "Bearer token_user1"},
    )
    assert resp.status_code == 200
    assert resp.json()["scope"] == "shared"

    # user2 现在应该能看到了
    resp = await client.get(
        "/api/todos/",
        headers={"Authorization": "Bearer token_user2"},
    )
    assert any(t["id"] == todo_id for t in resp.json()), \
        "改为共享后，同组成员应该能看到该待办"


# ==================== Agent 工具代码验证 ====================


def test_agent_update_todo_has_scope_parameter():
    """验证：Agent 工具 update_todo 接受 scope 参数"""
    from backend.app.agent.tools import update_todo

    # LangChain @tool wraps the function; check the tool's args schema
    schema = update_todo.args_schema.model_json_schema()
    props = schema.get("properties", {})
    assert "scope" in props, f"update_todo 工具缺少 scope 参数, 当前参数: {list(props.keys())}"
