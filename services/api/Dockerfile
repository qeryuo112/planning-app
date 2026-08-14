# 多阶段构建 NestJS API
FROM node:20-alpine AS builder

WORKDIR /app

# 先复制 package 文件以利用缓存层
COPY services/api/package*.json ./
RUN npm ci

COPY services/api ./
RUN npm run build

# 生产镜像
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY services/api/prisma ./prisma

EXPOSE 3000

CMD ["node", "dist/main"]
