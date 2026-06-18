# Admin Web

관리자와 검토자가 Platform API의 시험/문제/참가자 초대와 세션 위험 평가를
관리하는 독립 Next.js 앱입니다.

이 앱은 탐지 점수를 검토 우선순위 보조 정보로만 표시합니다. 탐지 점수만으로 응시자를 자동 탈락시키지 않는 정책을 화면에 명시합니다.

## Requirements

- Node.js 20 이상
- 실행 중인 Platform API (`apps/platform-api`, 기본 포트 `8001`)

## Configure

```bash
cp .env.example .env.local
```

`NEXT_PUBLIC_PLATFORM_API_URL`에 Admin Web 서버에서 접근 가능한 Platform API 주소를 설정합니다.

```env
NEXT_PUBLIC_PLATFORM_API_URL=http://localhost:8001
```

Admin Web의 동일 출처 API 라우트가 Platform API 요청을 전달하고 관리자
토큰을 HttpOnly 쿠키에 보관하므로 별도 CORS 설정은 필요하지 않습니다.

## Run

```bash
npm install
npm run dev
```

Admin Web은 기본적으로 `http://localhost:3001`에서 실행됩니다.

## Verify

```bash
npm run lint
npm run build
```

## Current limitations

- 이메일 발송은 아직 없으며, 참가자 초대 링크는 UI에서 복사해 전달합니다.
- 검토 의견 저장 기능은 없습니다.
- Platform API 연결 실패 시 현재는 연결 상태를 상세 분류하지 않고 일반 오류로 표시합니다.
