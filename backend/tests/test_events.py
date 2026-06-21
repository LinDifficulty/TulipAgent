"""日程事件测试"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_event(client: AsyncClient):
    """测试创建事件"""
    response = await client.post(
        "/api/events/",
        json={
            "title": "测试事件",
            "description": "这是一个测试事件",
            "start_time": "2026-06-15 10:00",
            "end_time": "2026-06-15 11:00",
            "created_by": "user1",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "测试事件"


@pytest.mark.asyncio
async def test_list_events(client: AsyncClient):
    """测试获取事件列表"""
    # 先创建一个事件
    await client.post(
        "/api/events/",
        json={
            "title": "测试事件",
            "start_time": "2026-06-15 10:00",
            "created_by": "user1",
        },
    )

    # 获取列表
    response = await client.get("/api/events/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_get_event(client: AsyncClient):
    """测试获取单个事件"""
    # 先创建
    create_response = await client.post(
        "/api/events/",
        json={
            "title": "测试事件",
            "start_time": "2026-06-15 10:00",
            "created_by": "user1",
        },
    )
    event_id = create_response.json()["id"]

    # 获取
    response = await client.get(f"/api/events/{event_id}")
    assert response.status_code == 200
    assert response.json()["title"] == "测试事件"


@pytest.mark.asyncio
async def test_update_event(client: AsyncClient):
    """测试更新事件"""
    # 先创建
    create_response = await client.post(
        "/api/events/",
        json={
            "title": "测试事件",
            "start_time": "2026-06-15 10:00",
            "created_by": "user1",
        },
    )
    event_id = create_response.json()["id"]

    # 更新
    response = await client.put(
        f"/api/events/{event_id}",
        json={"title": "更新后的事件"},
    )
    assert response.status_code == 200
    assert response.json()["title"] == "更新后的事件"


@pytest.mark.asyncio
async def test_delete_event(client: AsyncClient):
    """测试删除事件"""
    # 先创建
    create_response = await client.post(
        "/api/events/",
        json={
            "title": "测试事件",
            "start_time": "2026-06-15 10:00",
            "created_by": "user1",
        },
    )
    event_id = create_response.json()["id"]

    # 删除
    response = await client.delete(f"/api/events/{event_id}")
    assert response.status_code == 200

    # 确认已删除
    get_response = await client.get(f"/api/events/{event_id}")
    assert get_response.status_code == 404


