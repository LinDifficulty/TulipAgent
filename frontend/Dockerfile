# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 使用淘宝 npm 镜像
RUN npm config set registry https://registry.npmmirror.com

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# 默认使用空字符串，nginx 反向代理模式下前端和 API 同源
# 如需直连后端，设置为后端地址，如 http://your-server:8000
ENV NEXT_PUBLIC_API_URL=""

RUN npm run build

# 运行阶段
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
