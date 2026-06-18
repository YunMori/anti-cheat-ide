# Web IDE Anti-Cheat Platform

AI-assisted cheating risk detection and sandboxed code judging platform.

## Repository layout

### Live MVP (production-oriented)

These make up the running candidate-to-review system.

- `frontend/`: candidate-facing Monaco IDE (Candidate Web)
- `apps/platform-api/`: assessment, session, submission, and risk orchestration API
- `apps/admin-web/`: admin/reviewer login, assessment operations, invite generation, and review UI
- `services/judge-service/`: isolated code judging service (Docker sandbox)
- `services/detection-service/`: explainable, rule-based risk scoring service
- `docs/`: architecture, threat model, release gates, and `docs/contracts/` service contracts

### Legacy / Research (kept for further development)

Not part of the live request flow. Preserved and maintained for ongoing work;
the live services above do **not** import from these.

- `backend/`: WebSocket prototype for real-time human-likeness scoring
- `ai_engine/`: red-team human-like typing simulator (4-layer HMM/GAN/KLM pipeline)
  plus a proof-of-concept detector (`ai_engine/detector.py`)

New services must communicate only through the contracts under `docs/contracts/`,
not through each other's internals.

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
