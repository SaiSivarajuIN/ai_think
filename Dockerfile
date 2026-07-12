FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FLASK_DEBUG=false \
    SQLITE_DATABASE=/app/instance/chat.db \
    OLLAMA_BASE_URL=http://host.docker.internal:11434 \
    SEARXNG_URL=http://searxng:8080 \
    HOME=/app

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        poppler-utils \
        tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir gunicorn

RUN addgroup --system app \
    && adduser --system --home /app --ingroup app app

COPY --chown=app:app . .

RUN mkdir -p /app/instance /app/logger \
    && chown -R app:app /app

USER app

EXPOSE 1111

VOLUME ["/app/instance", "/app/logger"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import socket; socket.create_connection(('127.0.0.1', 1111), 5).close()"

CMD ["gunicorn", "--preload", "--bind", "0.0.0.0:1111", "--workers", "1", "--threads", "4", "--timeout", "180", "app:app"]
