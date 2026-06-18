# Web IDE Anti-Cheat Platform

AI-assisted cheating risk detection and sandboxed code judging platform.

## Repository layout

- `frontend/`: existing candidate-facing Monaco IDE
- `backend/`: existing WebSocket prototype
- `ai_engine/`: detection research and red-team typing simulator
- `apps/platform-api/`: assessment, session, and submission API
- `apps/admin-web/`: admin/reviewer login, assessment operations, invite generation, and review UI
- `services/judge-service/`: isolated code judging service
- `services/detection-service/`: explainable risk scoring service
- `docs/contracts/`: service contracts owned by the orchestrator

Existing nested Git repositories are intentionally preserved during the
initial migration. New services must communicate only through the contracts
under `docs/contracts/`.

## Delivery order

1. Stabilize contracts and platform structure.
2. Implement Platform API, Judge, and Detection services in parallel.
3. Integrate Candidate Web and Admin Web.
4. Run end-to-end, security, and load-oriented verification.

## Product policy

Risk signals support human review. A detection score alone must never
automatically reject a candidate.

## Current authentication flow

- The first Admin Web signup is automatically approved as `admin`.
- Later signups stay pending until an `admin` approves them as `admin` or
  `reviewer`.
- Admins create one-time candidate invite links from Admin Web.
- Candidate Web redeems an invite link to create a session before loading the
  IDE and sending behavioral events.
