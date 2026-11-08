# syntax=docker/dockerfile:1

FROM python:3.11-slim

# Pinned so the lockfile format and resolver behaviour do not change under us.
COPY --from=ghcr.io/astral-sh/uv:0.10.0 /uv /uvx /bin/

ARG EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2

# The venv and the model live outside /app on purpose: compose bind-mounts ./backend
# over /app for hot reload, which would hide anything the image put there.
ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/opt/venv/bin:$PATH" \
    FASTEMBED_CACHE_PATH=/models \
    EMBEDDING_MODEL=${EMBEDDING_MODEL}

WORKDIR /app

# Dependencies first, so code edits do not invalidate this layer.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Bake the ONNX model into the image: startup needs no network and cannot fail on a
# download. HF_HUB_OFFLINE afterwards makes any accidental download attempt fail fast.
RUN python -c "import os; from fastembed import TextEmbedding; TextEmbedding(os.environ['EMBEDDING_MODEL'])"
ENV HF_HUB_OFFLINE=1

COPY . .

EXPOSE 5001

CMD ["sh", "-c", "python scripts/seed_db.py && uvicorn app:app --host 0.0.0.0 --port 5001"]
