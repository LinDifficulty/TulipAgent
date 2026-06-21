FROM python:3.12-slim

WORKDIR /app

# 使用阿里云镜像加速 apt
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 先复制依赖文件，利用层缓存
COPY pyproject.toml .
# 如果有 uv.lock 则复制（可选）
# COPY uv.lock .

# 安装 Python 依赖（使用清华 pip 镜像）
RUN pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple .

# 再复制应用代码（依赖未变化时可复用缓存层）
COPY backend/ backend/

# 创建数据目录
RUN mkdir -p data/sqlite data/chroma data/files

EXPOSE 8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
