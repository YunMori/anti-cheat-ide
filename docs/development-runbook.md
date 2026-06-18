# 개발 런북(Development Runbook)

## 현재 서비스

| 서비스 | URL |
| --- | --- |
| Candidate Web | `http://localhost:3000` |
| Platform API | `http://localhost:8001` |
| Judge Service | `http://localhost:8002` |
| Detection Service | `http://localhost:8003` |

## macOS에서의 Docker

이 작업 공간은 Homebrew Docker CLI, Docker Compose, Buildx, Colima로 검증되었다:

```bash
brew install docker docker-compose docker-buildx colima
colima start --cpu 4 --memory 6 --disk 30
colima stop
brew services start colima
```

이전 Docker Desktop 설치가 `~/.docker/config.json`에 `"credsStore": "desktop"`
설정을 남겼다면, Colima로 이미지를 받기 전에 해당 설정을 제거하라.

승인된 Judge 언어 이미지를 미리 받아 두어, 다운로드 시간이 응시자 실행 제한 시간에
포함되지 않도록 하라:

```bash
make docker-prepull
```

## 검증 순서

먼저 서비스 유닛 테스트를 실행하고, 이어서 프론트엔드 검사와 통합 테스트를 실행하라.

```bash
cd ai_engine && PYTHONPATH=. pytest -q
cd frontend && npm run lint
cd frontend && npm run build
```

새 서비스가 도입될 때마다 추가 명령이 더해진다.

```bash
make test-platform
make test-judge
make test-detection
make test-integration
make lint-frontend
make lint-admin
```

기본 서비스 스택을 시작한다:

```bash
docker compose up --build platform-api detection-service
```

Judge Service는 호스트 Docker 데몬에 대한 명시적 접근이 필요하므로 옵트인(opt-in) 방식이다:

```bash
docker compose --profile judge up --build -d --wait judge-service
```

Docker 소켓을 마운트하면 호스트에 대한 상위 권한 제어가 부여된다. Judge 프로파일은
전용 개발 또는 실행 환경에서만 사용하라. 개발용 Compose 파일은 인증되지 않은 서비스
포트를 `127.0.0.1`에만 바인딩한다.

실제 Docker 샌드박스 검사를 실행한다:

```bash
make test-docker-runtime
```

## 로컬 보안 경계

임의의 응시자 소스 코드를 호스트에서 직접 실행하지 말라. Judge Service 개발 시
유닛 테스트에는 가짜(fake) 러너를, 실행 테스트에는 구성된 컨테이너 샌드박스를 사용해야 한다.

## 계약 변경

`docs/contracts/` 아래의 계약 변경은 구현 에이전트가 사용하기 전에 검토되어야 한다.
하위 호환을 깨는(breaking) 변경에는 버전 증가가 필요하다.
