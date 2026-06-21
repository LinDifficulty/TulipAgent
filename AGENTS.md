# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

TulipAgent is a personal AI assistant designed for couples, providing schedule management, todo management, express package tracking, and conversational AI. The UI and prompts are in Chinese.

## Tech Stack

- **Backend**: FastAPI + LangGraph (agent orchestration) + LangChain + SQLAlchemy (async) + SQLite (aiosqlite)
- **Frontend**: Next.js 14 + Tailwind CSS + Radix UI + lucide-react icons
- **Python**: 3.12+, managed with `uv` (see `uv.lock`)

## Common Commands

### Backend

```bash
# Start backend (from project root)
python main.py
# Backend runs at http://localhost:8000, API docs at /docs

# Run all tests
pytest

# Run a single test file
pytest backend/tests/test_events.py

# Run a single test function
pytest backend/tests/test_events.py::test_create_event

# Run tests with coverage
pytest --cov=backend --cov-report=html
```

### Frontend

```bash
cd frontend
npm install
npm run dev     # Dev server at http://localhost:3000
npm run lint    # ESLint
```

## Architecture

### Agent System (backend/app/agent/)

The core AI agent uses **LangGraph** with a two-node graph pattern:
- `agent` node: calls the LLM with bound tools, decides whether to call tools or return final answer
- `tools` node: executes tool calls, returns results back to agent
- The graph loops (agent -> tools -> agent) until the LLM produces a response without tool calls

**AgentState** (`graph.py`): TypedDict with `messages`, `user_id`, `account_id`, `group_id`.

**LLM Factory** (`llm_factory.py`): Registry-pattern factory supporting `openai`, `deepseek`, and `ollama` providers. Provider is selected via `LLM_PROVIDER` env var. DeepSeek uses the OpenAI-compatible API via `langchain_openai.ChatOpenAI`.

**Prompts** (`prompts.py`): System prompt with personality and capability descriptions. Uses `{user_info}` and `{current_date}` placeholders. Includes a `WELCOME_MESSAGE` for new sessions.

**Context** (`context.py`): Uses Python `contextvars` (`current_account_id`, `current_group_id`) to pass account info from the chat router to tools. Set before invoking the agent graph.

**Tools** (`tools.py`): All tools are `@tool`-decorated async functions that directly open their own DB sessions via `async_session_factory` (not injected). Tools use context vars for group-based data isolation.

Available tools:
- Schedule: `create_event`, `list_events`, `delete_event`
- Todos: `add_todo`, `list_todos`, `complete_todo`, `delete_todo`
- Packages: `add_package`, `list_packages`, `refresh_package`, `update_package`, `delete_package`
- Anniversaries: `add_anniversary`, `list_anniversaries`, `delete_anniversary`
- Utilities: `get_current_time`, `calculate`

### Auth System (backend/app/auth.py, backend/app/routers/auth.py)

Token-based authentication (no passwords). Accounts are created by admin.
- `auth.py`: FastAPI dependencies - `get_current_account` (Bearer token -> Account), `require_admin` (role == "admin").
- `routers/auth.py`: `POST /api/auth/login` (token login), `GET /api/auth/me` (current account), `GET /api/auth/check` (token validity check).
- Default admin account auto-created on startup with token `"admin"`.

### Admin Backend (backend/app/routers/admin.py)

Admin-only routes at `/api/admin` for managing accounts and user groups.
- Accounts: CRUD at `/api/admin/accounts`. Fields: `token`, `nickname`, `role` (admin/user), `group_id`, `is_active`.
- Groups: CRUD at `/api/admin/groups`. Members management at `/api/admin/groups/{id}/members`.
- Groups enable shared data - same-group accounts share all events, todos, and packages.

### Data Layer

- **Models** (`backend/app/models/`): SQLAlchemy ORM models - `User`, `Event`, `Todo`, `Package`, `Anniversary`, `Conversation`, `UserGroup`, `Account`. All inherit from `database.Base`.
- **Group-based isolation**: `Event`, `Todo`, `Package`, and `Anniversary` all have a `group_id` FK. When `group_id` is set, data is shared within the group. When null, data is scoped to the creator.
- **Database** (`backend/app/database.py`): Async SQLAlchemy engine with `aiosqlite`. Tables auto-created on startup via `init_db()`. DB session is a FastAPI dependency via `get_db()`.
- **Data directory**: SQLite DB at `./data/sqlite/`, Chroma at `./data/chroma/`, files at `./data/files/`.

### Package Tracking (backend/app/services/package_service.py)

Integration with **Kuaidi100 API** for express delivery tracking.
- `detect_carrier(tracking_number)`: Auto-detects carrier via API first, falls back to local regex rules for Chinese carriers (SF, ZTO, YTO, YD, STO, JD, JT, EMS, etc.).
- `query_tracking(carrier_code, tracking_number)`: Queries tracking info from Kuaidi100 API with multi-endpoint fallback (poll + api).
- Status values: "未发货" / "运输中" / "派送中" / "已签收" / "查询失败".

### Scheduler (backend/app/services/scheduler.py)

**APScheduler** (`AsyncIOScheduler`) auto-refreshes all non-delivered packages every 2 hours. Started/stopped via the FastAPI lifespan.

### API Routes (backend/app/routers/)

- `chat.py`: POST `/api/chat/send` (REST, auth required) + WebSocket `/api/chat/ws/{user_id}`. Sessions stored in-memory dict (not persisted). Sets `contextvars` before agent invocation.
- `events.py`: CRUD for schedule events (auth required, group-scoped)
- `todos.py`: CRUD for todo items + complete endpoint (auth required, group-scoped)
- `packages.py`: CRUD for packages at `/api/packages/` + refresh endpoint (auth required, group-scoped). Includes `/test-config` for debugging Kuaidi100 API.
- `anniversaries.py`: CRUD for anniversaries at `/api/anniversaries/` (auth required, group-scoped)
- `llm.py`: LLM config introspection + connection test
- `auth.py`: Login and token check
- `admin.py`: Account and group management (admin only)

### Configuration

- `backend/app/config.py`: Pydantic `Settings` class, reads from `.env`. Singleton via `@lru_cache`.
- Key settings: `LLM_PROVIDER`, `DEEPSEEK_API_KEY`, `KUAIDI100_CUSTOMER`, `KUAIDI100_KEY`
- Two predefined users in `settings.USERS`: `user1` ("主人") and `user2` ("宝贝").
- Copy `.env.example` to `.env` and set API keys before running.

### Frontend (frontend/src/)

Next.js app with responsive layout (desktop sidebar + mobile bottom nav).

**Auth**: `contexts/auth-context.tsx` - `AuthProvider` with token stored in `localStorage` (`tulip_token`). `useAuth()` hook provides `isAuthenticated`, `isAdmin`, `login`, `logout`. Login page at `/login` uses token-based input.

**API Client** (`lib/api.ts`): All API calls use `authFetch()` which auto-attaches Bearer token and redirects to `/login` on 401.

**Pages**:
- `/` (page.tsx): Main app - chat + work hub (events/todos/packages) with responsive layout
- `/login`: Token login form
- `/admin`: Admin dashboard (account + group management, admin-only)

**Components**: `chat-container`, `chat-input`, `chat-message`, `event-list`, `event-dialog`, `todo-list`, `todo-dialog`, `package-list`, `package-detail`, `package-dialog`, `package-edit-dialog`, `package-status`, `work-hub`, `anniversary-list`, `anniversary-dialog`.

**Middleware** (`middleware.ts`): Basic route matching, client-side auth via AuthContext.

## Key Patterns

- All DB operations in tools/routers are async (`async with async_session_factory() as session`).
- Agent graph is a module-level singleton (`get_agent_graph()`), call `reset_agent_graph()` to reload after config changes.
- Chat sessions are in-memory only (lost on restart) - stored in `routers.chat.sessions` dict.
- Anniversary model stores date-only fields (not datetime) with `repeat_rule` (yearly/none) for recurring reminders
- Tools use `eval()` in the `calculate` function with a character allowlist for safety.
- Agent tools receive account context via `contextvars` - set in chat router before calling agent, read in tools.
- Group-based data isolation: all CRUD tools filter by `group_id` (shared) or `created_by` (personal).