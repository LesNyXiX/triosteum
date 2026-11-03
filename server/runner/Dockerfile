# Исполнитель Python-блоков. Собирается из корня репозитория:
#   docker build -f server/runner/Dockerfile -t triosteum-runner .
# Контейнер запускается без сети наружу, только для чтения и с минимумом прав (см. docker-compose.yml).
# Процесс сервиса работает от root ВНУТРИ контейнера только затем, чтобы каждый запуск кода
# сбрасывал права до пользователя nobody (65534).
ARG PYTHON_IMAGE=python:3.12-slim
FROM ${PYTHON_IMAGE}
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
# библиотеки, доступные коду блоков
RUN pip install numpy pandas openpyxl
COPY server/runner/ /runner/
WORKDIR /runner
EXPOSE 8100
CMD ["python", "service.py"]
