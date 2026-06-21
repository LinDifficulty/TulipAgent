# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TulipAgent is a personal AI assistant designed for couples, providing schedule management, todo management, and conversational AI. The UI and prompts are in Chinese.

## Tech Stack

- **Backend**: FastAPI + LangGraph (agent orchestration) + LangChain + SQLAlchemy (async) + SQLite (aiosqlite)
- **Frontend**: Next.js 14 + Tailwind CSS + Radix UI
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
- The graph loops (agent → tools → agent) until the LLM produces a response without tool calls

**LLM Factory** (`llm_factory.py`): Registry-pattern factory supporting `openai`, `deepseek`, and `ollama` providers. Provider is selected via `LLM_PROVIDER` env var. DeepSeek uses the OpenAI-compatible API via `langchain_openai.ChatOpenAI`.

**Tools** (`tools.py`): All tools are `@tool`-decorated async functions that directly open their own DB sessions via `async_session_factory` (not injected). Tools: `create_event`, `list_events`, `delete_event`, `add_todo`, `list_todos`, `complete_todo`, `delete_todo`, `get_current_time`, `calculate`.

### Data Layer

- **Models** (`backend/app/models/`): SQLAlchemy ORM models — `User`, `Event`, `Todo`, `Conversation`. All inherit from `database.Base`.
- **Database** (`backend/app/database.py`): Async SQLAlchemy engine with `aiosqlite`. Tables auto-created on startup via `init_db()`. DB session is a FastAPI dependency via `get_db()`.
- **Data directory**: SQLite DB at `./data/sqlite/`, Chroma at `./data/chroma/`, files at `./data/files/`.

### API Routes (backend/app/routers/)

- `chat.py`: POST `/api/chat/send` (REST) + WebSocket `/api/chat/ws/{user_id}`. Sessions stored in-memory dict (not persisted).
- `events.py`: CRUD for schedule events
- `todos.py`: CRUD for todo items + complete endpoint
- `llm.py`: LLM config introspection + connection test

### Configuration

- `backend/app/config.py`: Pydantic `Settings` class, reads from `.env`. Singleton via `@lru_cache`.
- Two predefined users in `settings.USERS`: `user1` ("主人", admin) and `user2` ("宝贝", user).
- Copy `.env.example` to `.env` and set API keys before running.

### Frontend (frontend/src/)

Next.js app with chat interface as the primary interaction. Components: `chat-container`, `chat-input`, `chat-message`, `event-list`, `todo-list`. API client in `lib/api.ts`.

## Key Patterns

- All DB operations in tools/routers are async (`async with async_session_factory() as session`).
- Agent graph is a module-level singleton (`get_agent_graph()`), call `reset_agent_graph()` to reload after config changes.
- Chat sessions are in-memory only (lost on restart) — stored in `routers.chat.sessions` dict.
- Tools use `eval()` in the `calculate` function with a character allowlist for safety.
