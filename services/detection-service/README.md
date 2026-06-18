# Detection Service

Explainable, rule-based behavioral risk assessment for coding-test sessions.
The service consumes the `docs/contracts/event-schema.md` event batch and
returns the `docs/contracts/detection-api.yaml` risk assessment shape.

Detection output is evidence for human review. It is not a cheating verdict and
must not be used as an automatic rejection decision.

## Rules and scoring

Each rule returns a severity from `0` to `100` and its observed evidence. The
overall risk score is the weighted sum, capped to `0` through `100`.
Reaching a rule threshold starts that signal at severity `25`; severity then
increases toward `100` at the rule's documented ceiling.

```text
risk_score =
  paste_spike * 0.30 +
  code_burst * 0.30 +
  typing_regularity * 0.25 +
  focus_loss * 0.15
```

| Signal | Weight | Starts scoring when |
| --- | ---: | --- |
| `paste_spike` | 30% | A paste inserts at least 40 characters, suspicious paste total reaches 80, or two suspicious pastes occur |
| `code_burst` | 30% | One code change inserts at least 80 characters or 160 characters arrive within 2 seconds |
| `typing_regularity` | 25% | At least 20 usable gaps exist and timing variation is unusually low or one 10 ms timing bucket dominates |
| `focus_loss` | 15% | Focus is lost at least 3 times or total focus loss reaches 30 seconds |

`review_recommended` becomes `true` at an overall risk score of `50`.
Thresholds, weights, observed values, and key event pairing quality are included
in each signal's `evidence`.

## Run locally

The default development port is `8003`.

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8003
```

Then use:

- `GET http://localhost:8003/health`
- `POST http://localhost:8003/assess`
- `GET http://localhost:8003/docs`

## Test

```bash
.venv/bin/python -m pytest
```

## Docker

```bash
docker build -t detection-service .
docker run --rm -p 8003:8003 detection-service
```

## Current limitations

- `/assess` evaluates one supplied batch and does not persist prior batches.
- The service cannot detect missing sequence ranges without session history.
- Thresholds are initial policy values and require calibration against
  consented, representative assessment data.
- Browser events can be forged by a malicious client; server-side integrity
  controls belong at the ingestion boundary.
