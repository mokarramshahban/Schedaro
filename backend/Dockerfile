FROM rust:1.85-bookworm AS rust-builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-dev python3-pip \
    && rm -rf /var/lib/apt/lists/* \
    && python3 -m pip install --break-system-packages --no-cache-dir maturin==1.8.6

WORKDIR /build/schedaro_engine
COPY rust/schedaro_engine/ ./
RUN maturin build --release --manifest-path Cargo.toml --out /wheels --interpreter python3

FROM python:3.13-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONPATH=/app

COPY --from=rust-builder /wheels/*.whl /tmp/wheels/
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir /tmp/wheels/*.whl \
    && rm -rf /tmp/wheels requirements.txt

COPY backend/ .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
