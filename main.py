"""TulipAgent 启动入口"""
import logging
import uvicorn
from backend.app.config import get_settings

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)


def main():
    """启动应用"""
    settings = get_settings()
    is_debug = settings.DEBUG

    print("🌷 TulipAgent 正在启动...")
    if is_debug:
        print("📝 API 文档: http://localhost:8000/docs")
        print("🌐 前端界面: http://localhost:3000")

    uvicorn.run(
        "backend.app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=is_debug,
        reload_dirs=["backend"] if is_debug else None,
    )


if __name__ == "__main__":
    main()
