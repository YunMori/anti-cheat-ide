from fastapi import FastAPI

from .models import EventBatch, HealthResponse, RiskAssessment
from .rules import assess_batch


app = FastAPI(
    title="Detection Service API",
    version="0.1.0",
    description=(
        "Explainable rule-based behavioral risk assessment. Results are review "
        "signals and must not be treated as automatic rejection decisions."
    ),
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="detection-service", version="0.1.0")


@app.post("/assess", response_model=RiskAssessment)
def assess_risk(batch: EventBatch) -> RiskAssessment:
    return RiskAssessment.from_domain(assess_batch(batch.to_domain()))
