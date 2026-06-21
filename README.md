# 🌷 TulipAgent

一个贴心的个人AI助理，专为情侣设计，提供日程管理、纪念日、待办事项等服务。

## ✨ 功能特性

### 🗓️ 日程管理
- 创建、查看、编辑、删除日程事件
- 提前提醒设置
- 重复事件支持

### 📝 待办事项
- 创建待办任务
- 分配给指定用户
- 优先级设置（高/中/低）
- 完成状态追踪

### 💬 智能对话
- 自然语言交互
- 自动调用相关工具
- 多轮对话支持
- 上下文记忆

## 🛠️ 技术栈

### 后端
- **FastAPI** - Web 框架
- **LangGraph** - Agent 编排
- **LangChain** - LLM 工具链
- **SQLAlchemy** - ORM
- **SQLite** - 数据库

### 前端
- **Next.js 14** - React 框架
- **Tailwind CSS** - 样式
- **Radix UI** - 组件库

## 🚀 快速开始

### 1. 环境准备

确保已安装：
- Python 3.12+
- Node.js 18+
- npm 或 yarn

### 2. 后端设置

```bash
# 安装依赖
cd TulipAgent
pip install -e .

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，设置 LLM 配置

# 启动后端
python main.py
```

后端将在 http://localhost:8000 启动
API 文档：http://localhost:8000/docs

### 3. 前端设置

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端将在 http://localhost:3000 启动

### 4. LLM 配置

项目使用工厂模式支持多种 LLM 提供商，在 `.env` 文件中配置：

#### 方案一：DeepSeek API (推荐，性价比高)
```env
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=your-api-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

#### 方案二：OpenAI API
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

#### 方案三：本地模型 (Ollama)
```bash
# 安装 Ollama
# https://ollama.ai

# 拉取模型
ollama pull qwen2.5:7b
```

```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
```

### 5. 测试 LLM 连接

启动后端后，可以通过 API 测试 LLM 连接：

```bash
# 查看 LLM 配置
curl http://localhost:8000/api/llm/config

# 测试连接
curl -X POST http://localhost:8000/api/llm/test

# 查看可用提供商
curl http://localhost:8000/api/llm/providers
```

## 📁 项目结构

```
TulipAgent/
├── backend/
│   ├── app/
│   │   ├── agent/          # Agent 核心
│   │   │   ├── graph.py    # LangGraph 工作流
│   │   │   ├── tools.py    # 工具定义
│   │   │   ├── prompts.py  # 提示词
│   │   │   └── llm_factory.py  # LLM 工厂
│   │   ├── models/         # 数据模型
│   │   ├── routers/        # API 路由
│   │   ├── config.py       # 配置
│   │   ├── database.py     # 数据库
│   │   └── main.py         # 应用入口
│   └── tests/              # 测试文件
├── frontend/
│   ├── src/
│   │   ├── app/            # 页面
│   │   ├── components/     # 组件
│   │   ├── hooks/          # Hooks
│   │   └── lib/            # 工具函数
│   └── package.json
├── data/                   # 数据存储
├── .env                    # 环境变量
├── pyproject.toml          # Python 配置
└── README.md
```

## 🧪 运行测试

### 后端测试
```bash
# 安装测试依赖
pip install -e ".[dev]"

# 运行测试
pytest

# 运行带覆盖率的测试
pytest --cov=backend --cov-report=html
```

### 前端测试
```bash
cd frontend
npm run lint
```

## 📝 API 文档

启动后端后访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 主要 API 端点

#### 聊天
- `POST /api/chat/send` - 发送消息
- `GET /api/chat/welcome` - 获取欢迎消息
- `WebSocket /api/chat/ws/{user_id}` - 实时聊天

#### 日程
- `POST /api/events/` - 创建事件
- `GET /api/events/` - 获取事件列表
- `PUT /api/events/{id}` - 更新事件
- `DELETE /api/events/{id}` - 删除事件

#### 待办
- `POST /api/todos/` - 创建待办
- `GET /api/todos/` - 获取待办列表
- `POST /api/todos/{id}/complete` - 完成待办
- `DELETE /api/todos/{id}` - 删除待办

#### 纪念日
- `POST /api/anniversaries/` - 创建纪念日
- `GET /api/anniversaries/` - 获取纪念日列表
- `PUT /api/anniversaries/{id}` - 更新纪念日
- `DELETE /api/anniversaries/{id}` - 删除纪念日

#### LLM 配置
- `GET /api/llm/config` - 获取当前 LLM 配置
- `GET /api/llm/providers` - 获取可用提供商列表
- `POST /api/llm/test` - 测试 LLM 连接
- `POST /api/llm/reset` - 重置 LLM 配置

## 🎯 使用示例

### 通过对话使用
```
用户: 帮我创建一个明天下午3点的会议
助手: ✅ 已创建事件「会议」，时间：2026-06-14 15:00

用户: 添加一个待办，周末买菜
助手: ✅ 已添加待办「周末买菜」
```

### 直接调用 API
```bash
# 创建事件
curl -X POST http://localhost:8000/api/events/ \
  -H "Content-Type: application/json" \
  -d '{"title": "约会", "start_time": "2026-06-14 19:00"}'

```

## 🔧 配置说明

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| LLM_PROVIDER | LLM 提供商 | deepseek |
| DEEPSEEK_API_KEY | DeepSeek API 密钥 | - |
| DEEPSEEK_BASE_URL | DeepSeek API 基础 URL | https://api.deepseek.com |
| DEEPSEEK_MODEL | DeepSeek 模型名 | deepseek-chat |
| OPENAI_API_KEY | OpenAI API 密钥 | - |
| OPENAI_BASE_URL | OpenAI API 基础 URL | https://api.openai.com/v1 |
| LLM_MODEL | OpenAI 模型名 | gpt-4o-mini |
| OLLAMA_BASE_URL | Ollama 服务地址 | http://localhost:11434 |
| OLLAMA_MODEL | Ollama 模型名 | qwen2.5:7b |
| LLM_TEMPERATURE | LLM 温度参数 | 0.7 |
| LLM_MAX_TOKENS | 最大 token 数 | 2000 |
| DATABASE_URL | 数据库连接字符串 | sqlite+aiosqlite:///./data/sqlite/tulipagent.db |
| DEBUG | 调试模式 | true |

### LLM 工厂模式

项目使用工厂模式支持多种 LLM 提供商：

```python
from backend.app.agent.llm_factory import get_llm, get_llm_info

# 获取当前配置的 LLM
llm = get_llm()

# 获取指定提供商的 LLM
llm = get_llm("deepseek")
llm = get_llm("openai")
llm = get_llm("ollama")

# 获取 LLM 配置信息
info = get_llm_info()
```

支持的提供商：
- **deepseek** - DeepSeek API (推荐，性价比高)
- **openai** - OpenAI API
- **ollama** - Ollama 本地模型

## 📌 注意事项

1. **数据安全**：所有数据存储在本地，不会上传到云端
2. **LLM 选择**：推荐使用 DeepSeek API，性价比高且支持中文
3. **备份**：定期备份 `data/` 目录
4. **性能**：本地模型需要较好的硬件配置

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
