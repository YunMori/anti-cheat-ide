# Candidate Web

Next.js와 Monaco Editor 기반 코딩 테스트 응시자 화면입니다. 에디터
안에서 발생한 키 입력, 붙여넣기 메타데이터, 코드 변경 및 브라우저 포커스
변경을 Platform API 이벤트 계약에 맞춰 수집합니다. 클립보드 내용과 전체
코드 내용은 이벤트 API로 전송하지 않습니다.

## Configuration

`.env.local`에 실행 중인 Platform API 주소를 설정합니다. 응시자는 Admin
Web에서 생성한 초대 링크로 접속하고, 링크를 사용하면 세션이 생성됩니다.

```bash
NEXT_PUBLIC_PLATFORM_API_URL=http://localhost:8001
```

Platform API는 Candidate Web origin을 허용하도록 CORS가 설정되어 있어야
합니다.

## Run

```bash
npm install
npm run dev
```

관리자가 생성한 `http://localhost:3000/?invite=...` 링크를 엽니다.

## Event delivery

- 이벤트마다 브라우저 client UUID 기반 ID와 editor revision을 부여합니다.
- 이벤트는 2초마다 최대 250개씩 sequence 순서로 전송합니다.
- 미전송 이벤트와 다음 sequence는 세션별 `localStorage` 큐에 보관합니다.
- 네트워크 또는 API 실패 시 큐를 유지하고 2초마다 재시도합니다.
- `409` sequence 충돌이 발생하면 이벤트를 삭제하지 않고 큐에 보존하며,
  다른 탭을 닫고 감독자에게 문의하도록 안내합니다.

## Verify

```bash
npm run lint
npm run build
```
