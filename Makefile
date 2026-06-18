.PHONY: test test-ai test-backend test-platform test-judge test-detection test-integration test-docker-runtime lint-frontend lint-admin build-frontend build-admin docker-prepull dev-services dev-judge

test: test-ai test-backend test-platform test-judge test-detection test-integration lint-frontend lint-admin

test-ai:
	cd ai_engine && PYTHONPATH=. python3 -m pytest -q

test-backend:
	cd backend && PYTHONPATH=. ../.venv/bin/python -m pytest -q

test-platform:
	cd apps/platform-api && ../../.venv/bin/python -m pytest -q

test-judge:
	cd services/judge-service && ../../.venv/bin/python -m pytest -q

test-detection:
	cd services/detection-service && ../../.venv/bin/python -m pytest -q -rs

test-integration:
	.venv/bin/python -m pytest -q tests/integration

test-docker-runtime: docker-prepull
	docker compose --profile judge up --build -d --wait judge-service
	JUDGE_RUNTIME_URL=http://127.0.0.1:8002 .venv/bin/python -m pytest -q tests/integration/test_judge_docker_runtime.py

docker-prepull:
	docker pull python:3.12-alpine
	docker pull node:22-alpine
	docker pull gcc:14-bookworm
	docker pull eclipse-temurin:21-jdk-jammy

lint-frontend:
	cd frontend && npm run lint

lint-admin:
	cd apps/admin-web && npm run lint

build-frontend:
	cd frontend && npm run build

build-admin:
	cd apps/admin-web && npm run build

dev-services:
	docker compose up --build platform-api detection-service

dev-judge:
	docker compose --profile judge up --build judge-service
