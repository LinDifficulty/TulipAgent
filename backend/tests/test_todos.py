"""待办事项测试"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_todo(client: AsyncClient):
    """测试创建待办"""
    response = await client.post(
        "/api/todos/",
        json={
            "title": "买菜",
            "description": "买西红柿和鸡蛋",
            "due_date": "2026-06-15",
            "priority": "medium",
            "created_by": "user1",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "买菜"
    assert data["completed"] == False


@pytest.mark.asyncio
async def test_list_todos(client: AsyncClient):
    """测试获取待办列表"""
    # 创建待办
    await client.post(
        "/api/todos/",
        json={
            "title": "待办1",
            "created_by": "user1",
        },
    )
    await client.post(
        "/api/todos/",
        json={
            "title": "待办2",
            "created_by": "user1",
        },
    )

    # 获取列表
    response = await client.get("/api/todos/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2


@pytest.mark.asyncio
async def test_complete_todo(client: AsyncClient):
    """测试完成待办"""
    # 先创建
    create_response = await client.post(
        "/api/todos/",
        json={
            "title": "待完成的事项",
            "created_by": "user1",
        },
    )
    todo_id = create_response.json()["id"]

    # 完成
    response = await client.post(f"/api/todos/{todo_id}/complete")
    assert response.status_code == 200
    assert response.json()["completed"] == True
    assert response.json()["completed_at"] is not None


@pytest.mark.asyncio
async def test_update_todo(client: AsyncClient):
    """测试更新待办"""
    # 先创建
    create_response = await client.post(
        "/api/todos/",
        json={
            "title": "原始标题",
            "created_by": "user1",
        },
    )
    todo_id = create_response.json()["id"]

    # 更新
    response = await client.put(
        f"/api/todos/{todo_id}",
        json={"title": "更新后的标题", "priority": "high"},
    )
    assert response.status_code == 200
    assert response.json()["title"] == "更新后的标题"
    assert response.json()["priority"] == "high"


@pytest.mark.asyncio
async def test_delete_todo(client: AsyncClient):
    """测试删除待办"""
    # 先创建
    create_response = await client.post(
        "/api/todos/",
        json={
            "title": "待删除的事项",
            "created_by": "user1",
        },
    )
    todo_id = create_response.json()["id"]

    # 删除
    response = await client.delete(f"/api/todos/{todo_id}")
    assert response.status_code == 200

    # 确认列表中不存在
    list_response = await client.get("/api/todos/")
    assert all(t["id"] != todo_id for t in list_response.json())


