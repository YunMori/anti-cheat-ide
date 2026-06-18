FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY platform_api ./platform_api
COPY alembic.ini .
COPY alembic ./alembic

EXPOSE 8001

CMD ["sh", "-c", "alembic upgrade head && uvicorn platform_api.main:app --host 0.0.0.0 --port 8001"]
