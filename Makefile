.PHONY: help install dev db-up db-down lint test

help:
	@echo "可用命令："
	@echo "  make install    安装所有工作区依赖"
	@echo "  make db-up      启动 Postgres + Redis"
	@echo "  make db-down    停止 Postgres + Redis"
	@echo "  make dev        启动 API 开发服务"
	@echo "  make lint       运行后端 lint"
	@echo "  make test       运行后端测试"

install:
	npm install
	npm run build:schema
	npm run prisma:generate -w services/api

db-up:
	docker-compose up -d postgres redis

db-down:
	docker-compose down

dev:
	npm run dev:api

lint:
	npm run lint -w services/api

test:
	npm run test -w services/api
