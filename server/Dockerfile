# Образ сервера Triosteum. Собирается из корня репозитория:
#   docker build -f server/Dockerfile -t triosteum .
ARG PYTHON_IMAGE=python:3.12-slim
FROM ${PYTHON_IMAGE}

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /srv
COPY server/requirements.txt server/requirements.txt
RUN pip install -r server/requirements.txt

COPY server/ server/
COPY docs/index.html docs/index.html
RUN useradd --system --no-create-home triosteum
USER triosteum

WORKDIR /srv/server
ENV CLIENT_HTML=/srv/docs/index.html
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
