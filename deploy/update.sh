#!/usr/bin/env bash
# Обновление Triosteum до последней версии из GitHub:  sudo bash deploy/update.sh
# Перед обновлением делается резервная копия базы; новые миграции применяются при запуске сервера.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
COMPOSE=(docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml)
echo "▸ Резервная копия перед обновлением"; bash deploy/backup.sh
echo "▸ Забираю новую версию"; git pull --ff-only
echo "▸ Пересобираю и перезапускаю"; "${COMPOSE[@]}" up -d --build
for _ in $(seq 1 40); do curl -fsS http://127.0.0.1:8000/api/health >/dev/null 2>&1 && { echo "▸ Готово: $(git log -1 --format='%h %s')"; exit 0; }; sleep 3; done
echo "Сервер не ответил после обновления. Журнал: ${COMPOSE[*]} logs --tail 100 api" >&2; exit 1
