# Platform API

FastAPI MVP for assessments, manually authored problems, candidate sessions,
behavioral event ingestion, submissions, admin authentication, candidate
invites, and evidence-backed risk lookup.

The service follows the contracts under `docs/contracts/`. It uses PostgreSQL
when `DATABASE_URL` is configured and keeps a thread-safe in-memory repository
for tests and lightweight local development.

## Run locally

Use Python 3.12 or later.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn platform_api.main:app --reload --port 8001
```

The default development port is `8001`. OpenAPI documentation is available at
`http://localhost:8001/docs`.

Set these environment variables for the production-oriented path:

```bash
DATABASE_URL=postgresql+psycopg://platform:platform@localhost:5432/platform
AUTH_TOKEN_SECRET=replace-with-a-random-secret
INVITE_PUBLIC_BASE_URL=http://localhost:3000
```

The first admin signup is approved automatically as `admin`. Later signups are
created as `pending` and must be approved by an existing admin.

Set `DETECTION_SERVICE_URL=http://localhost:8003` to assess each accepted event
batch and expose the latest result through the session risk endpoint. Event
ingestion remains available if Detection Service is temporarily unavailable.
The in-memory MVP retains the highest observed session risk so a later benign
batch cannot erase prior evidence.

## Run tests

```bash
pytest
```

## Docker

```bash
docker build -t web-ide-platform-api .
docker run --rm -p 8001:8001 web-ide-platform-api
```

## Sequence policy

Event sequences start at `0` for each session and advance by the number of
accepted events. A duplicate, missing, or out-of-order `sequence_start`
returns HTTP `409`. Batches and submissions are append-only.

## Current limitations

- Database schema creation currently uses SQLAlchemy `create_all`; a dedicated
  migration workflow is still needed before production rollout.
- Organization-level authorization is not implemented beyond admin/reviewer
  role checks.
- Participant invite links are copied from Admin Web; email delivery is not
  implemented.
- Submission requests are stored with `queued` status but are not yet sent to
  Judge Service.
