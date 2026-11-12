# Образ сервера Triosteum. Собирается из корня репозитория:
#   docker build -f server/Dockerfile -t triosteum .
ARG PYTHON_IMAGE=python:3.12-slim
ARG NODE_IMAGE=node:22-slim

# 1. Сайт: docs/index.html в репозитории не хранится — собираем его здесь из src/
FROM ${NODE_IMAGE} AS web
WORKDIR /web
COPY package.json build.mjs ./
# без доступа к npm сборка всё равно пройдёт — просто без сжатия
RUN npm install --no-save --no-audit --no-fund --ignore-scripts "esbuild@$(node -p "require('./package.json').devDependencies.esbuild")" \
    || echo "npm недоступен — сайт соберётся без сжатия"
COPY src/ src/
RUN node build.mjs

# 2. Сервер
FROM ${PYTHON_IMAGE}

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /srv
COPY server/requirements.txt server/requirements.txt
RUN pip install -r server/requirements.txt

COPY server/ server/
COPY --from=web /web/docs/index.html docs/index.html
RUN useradd --system --no-create-home triosteum
USER triosteum

WORKDIR /srv/server
ENV CLIENT_HTML=/srv/docs/index.html
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
