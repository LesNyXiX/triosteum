#!/usr/bin/env bash
# Резервная копия базы Triosteum:  sudo bash deploy/backup.sh
# Копии лежат в backups/ (только для root), хранятся KEEP_DAYS дней (по умолчанию 14).
# Совет: дополнительно включите в Yandex Cloud расписание снимков диска — это копия вне сервера.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
KEEP_DAYS="${KEEP_DAYS:-14}"
COMPOSE=(docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml)
[ -f deploy/docker-compose.prod.yml ] && grep -q '^DOMAIN=.' .env 2>/dev/null || COMPOSE=(docker compose)
mkdir -p backups && chmod 700 backups
f="backups/triosteum-$(date +%Y%m%d-%H%M%S).dump"
"${COMPOSE[@]}" exec -T db pg_dump -U triosteum_owner -d triosteum -Fc > "$f.part"
[ -s "$f.part" ] || { rm -f "$f.part"; echo "Копия пустая — проверьте, что база запущена" >&2; exit 1; }
mv "$f.part" "$f"; chmod 600 "$f"
find backups -name 'triosteum-*.dump' -mtime +"$KEEP_DAYS" -delete
echo "$(date '+%F %T') копия: $f ($(du -h "$f" | cut -f1))"
