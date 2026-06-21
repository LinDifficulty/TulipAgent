# TulipAgent 部署指南

## 前置要求

- 一台 VPS（推荐 2GB+ 内存）
- 已安装 Docker 和 Docker Compose
- 已安装 Git

## 快速部署

### 1. 安装 Docker（如未安装）

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# 重新登录以生效
```

### 2. 克隆项目

```bash
git clone <your-repo-url> tulipagent
cd tulipagent
```

### 3. 配置环境变量

```bash
cp .env.production.example .env
```

编辑 `.env` 文件，必须修改以下配置：

```env
# 设置为你的服务器 IP 或域名
NEXT_PUBLIC_API_URL=http://your-server-ip

# 填入你的 DeepSeek API Key
DEEPSEEK_API_KEY=your_actual_api_key
```

### 4. 启动服务

```bash
docker compose up -d --build
```

### 5. 验证部署

```bash
# 检查容器状态
docker compose ps

# 应该看到三个容器都在 running 状态
# tulipagent-backend
# tulipagent-frontend
# tulipagent-nginx
```

访问 `http://your-server-ip` 应该能看到登录页面。

## SSL/HTTPS 配置（可选）

使用 Let's Encrypt 免费证书：

### 方案一：使用 Certbot（推荐）

```bash
# 安装 certbot
sudo apt install certbot

# 获取证书（需要先将域名解析到服务器 IP）
sudo certbot certonly --standalone -d your-domain.com

# 证书会保存在 /etc/letsencrypt/live/your-domain.com/
```

然后修改 `nginx/default.conf`，添加 HTTPS 配置：

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # ... 其他配置保持不变 ...
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}
```

修改 `docker-compose.yml`，挂载证书目录：

```yaml
nginx:
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
```

重启服务：

```bash
docker compose restart nginx
```

### 方案二：使用 Caddy（自动 HTTPS）

如果不想手动配置，可以用 Caddy 替代 Nginx：

```yaml
# docker-compose.yml 中替换 nginx 为 caddy
caddy:
    image: caddy:alpine
    container_name: tulipagent-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    depends_on:
      - backend
      - frontend
    networks:
      - tulipagent
```

```caddyfile
# Caddyfile
your-domain.com {
    reverse_proxy /api/* backend:8000
    reverse_proxy frontend:3000
}
```

## 数据备份

所有数据都存储在 `./data` 目录中：

```bash
# 备份
tar -czf backup-$(date +%Y%m%d).tar.gz data/

# 恢复
tar -xzf backup-20240101.tar.gz
```

建议定期备份，特别是 `data/sqlite/` 目录中的数据库文件。

## 常用命令

```bash
# 查看日志
docker compose logs -f

# 查看某个服务的日志
docker compose logs -f backend

# 重启所有服务
docker compose restart

# 重建并重启（代码更新后）
docker compose up -d --build

# 停止所有服务
docker compose down

# 停止并删除数据卷（危险！会丢失数据）
docker compose down -v
```

## 更新部署

```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker compose up -d --build
```

## 常见问题

### 无法访问页面

1. 检查防火墙是否开放 80 端口：`sudo ufw allow 80`
2. 检查容器是否正常运行：`docker compose ps`
3. 查看日志排查错误：`docker compose logs`

### API 请求失败

1. 确认 `.env` 中的 `NEXT_PUBLIC_API_URL` 设置正确
2. 检查后端日志：`docker compose logs backend`
3. 测试后端健康检查：`curl http://localhost:8000/health`

### 数据丢失

数据通过 Docker volume 挂载在 `./data` 目录。只要不执行 `docker compose down -v` 或删除 `data/` 目录，数据就不会丢失。
