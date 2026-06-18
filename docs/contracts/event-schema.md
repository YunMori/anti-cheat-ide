# 세션 이벤트 계약(Session Event Contract)

버전: `1.0`

Candidate Web은 이벤트 배치를 Platform API 또는 Detection Service로 보낸다. 모든
타임스탬프는 브라우저에서 생성된 Unix epoch 밀리초다.

## 이벤트 배치

```json
{
  "schema_version": "1.0",
  "session_id": "ses_123",
  "sequence_start": 42,
  "sent_at": 1781510400000,
  "events": []
}
```

`sequence_start`는 세션별로 단조 증가하며, 서버가 중복되거나 누락된 배치를 탐지할 수
있게 한다.

## 공통 필드

모든 이벤트는 다음을 포함한다:

```json
{
  "id": "evt_client_generated_uuid",
  "type": "keydown",
  "timestamp": 1781510400000,
  "editor_revision": 12
}
```

## 지원하는 이벤트 타입

### 키 이벤트(Key event)

```json
{
  "id": "evt_1",
  "type": "keydown",
  "timestamp": 1781510400000,
  "editor_revision": 12,
  "key": "a",
  "code": "KeyA",
  "cursor_offset": 20
}
```

`type`은 `keydown` 또는 `keyup`이다. 시험 에디터 밖의 OS 수준 이벤트는 수집하지 않는다.

### 붙여넣기 이벤트(Paste event)

```json
{
  "id": "evt_2",
  "type": "paste",
  "timestamp": 1781510400100,
  "editor_revision": 13,
  "inserted_character_count": 120,
  "cursor_offset": 20
}
```

클립보드 내용은 수집하지 않는다.

### 코드 변경 이벤트(Code change event)

```json
{
  "id": "evt_3",
  "type": "code_change",
  "timestamp": 1781510400200,
  "editor_revision": 14,
  "inserted_character_count": 5,
  "deleted_character_count": 1,
  "cursor_offset": 24
}
```

### 포커스 이벤트(Focus event)

```json
{
  "id": "evt_4",
  "type": "focus_change",
  "timestamp": 1781510400300,
  "editor_revision": 14,
  "focused": false
}
```

## 보존(Retention)

원시 이벤트에는 명시적인 보존 정책이 필요하다. 집계된 위험 신호는 별도로 보존할 수
있다. Detection 출력을 자동 탈락 결정으로 취급해서는 안 된다.
