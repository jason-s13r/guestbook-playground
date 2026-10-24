FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

# git + ssh are needed to clone/push approved entries
RUN apt-get update \
    && apt-get install -y --no-install-recommends git openssh-client ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --locked --no-dev --no-install-project

COPY main.py ./

# Telethon session file and downloaded media land in the working dir,
# so run from a volume to keep the login across restarts.
WORKDIR /data
VOLUME /data

EXPOSE 5000

CMD ["python", "/app/main.py"]
