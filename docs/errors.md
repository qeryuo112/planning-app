# 错误与改正记录

## 2026-08-11 Prisma 关系字段缺失对端引用

### 现象

执行 `npm run prisma:generate -w services/api` 时报错：

```text
Error validating field `user` in model `Project`: The relation field `user` on model `Project` is missing an opposite relation field on the model `User`.

Error validating field `goal` in model `GoalHabitLink`: The relation field `goal` on model `GoalHabitLink` is missing an opposite relation field on the model `Goal`.
```

### 原因

Prisma 要求在关系双方都声明关系字段。`Project.user` 指向 `User`，但 `User` 模型缺少 `Project[]`；`GoalHabitLink.goal` 指向 `Goal`，但 `Goal` 模型缺少 `GoalHabitLink[]`。

### 改正方案

在 `prisma/schema.prisma` 中：

1. `User` 模型添加 `projects Project[]`。
2. `Goal` 模型添加 `goalLinks GoalHabitLink[]`。

重新执行 `npm run prisma:generate -w services/api` 成功。

### 后续预防

- 使用 `prisma format` 自动格式化并检查关系完整性。
- 每次新增关系后，先运行 `prisma generate` 验证 schema。

## 2026-08-11 Flutter 便携包安装失败（网络重置）→ 已解决

### 现象

首次尝试 `git clone -b stable --depth 1 https://github.com/flutter/flutter.git tools/flutter` 时失败：

```text
fatal: unable to access 'https://github.com/flutter/flutter.git/': Recv failure: Connection was reset
```

### 原因

当时网络到 GitHub 被重置，无法下载 Flutter SDK；国内镜像 URL 不正确或需要登录。

### 改正方案

用户开启 VPN 后，重新从 GitHub 官方仓库 clone 成功：

```bash
git clone -b stable --depth 1 https://github.com/flutter/flutter.git tools/flutter
cd apps/mobile && ../../tools/flutter/bin/flutter pub get
```

验证结果：`flutter analyze` 无问题。

### 后续预防

- 保持 `tools/flutter` 在本地，运行前设置 PATH 或使用完整路径 `tools/flutter/bin/flutter`。
- 若更换机器，优先用 VPN + 官方仓库，避免国内镜像地址失效。

## 2026-08-11 Docker Hub 拉取失败 → 已解决（服务器）

### 现象

服务器上执行 `docker compose up -d --build` 时拉取 `postgres:15-alpine` 失败：

```text
failed to resolve reference "docker.io/library/postgres:15-alpine": ... Connection refused
```

### 原因

服务器 outbound 到 Docker Hub 被限制，且默认 DNS 无法解析国内镜像域名。

### 改正方案

1. 配置 Docker daemon 使用 DaoCloud 等可用镜像：

```json
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://docker.mirrors.sjtug.sjtu.edu.cn",
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com"
  ]
}
```

2. 设置 DNS 为 `114.114.114.114` 后重启 Docker。
3. `docker pull postgres:15-alpine` 成功。

### 后续预防

- 服务器 `/etc/docker/daemon.json` 已保留镜像配置。
- 若未来镜像失效，可替换为阿里云镜像加速器（需登录阿里云获取专属地址）。

## 2026-08-11 Docker 未安装

### 现象

本地环境未检测到 Docker，无法通过 `docker-compose` 一键拉起 Postgres 与 Redis。

### 影响

- `make db-up` 与 `docker-compose` 命令无法执行。
- 后端 integration/e2e 测试暂时无法连接真实数据库。

### 改正方案 / 后续处理

1. 用户自行安装 Docker Desktop（Windows）后，`make db-up` 即可使用。
2. 在 Week 1 中优先使用单元测试 + PrismaClient mock，减少对真实数据库的依赖。
3. 若用户无法安装 Docker，后续可考虑：
   - 使用云数据库实例并修改 `.env` 中的 `DATABASE_URL`。
   - 引入 `pglite` 等轻量级 Postgres 方案进行本地测试。
