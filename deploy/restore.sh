#!/usr/bin/env bash
# Восстановление базы из резервной копии:  sudo bash deploy/restore.sh backups/triosteum-20261103-033000.dump
# ВНИМАНИЕ: текущие данные заменяются данными из копии. Перед этим делается копия текущего состояния.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
f="${1:-}"; [ -f "$f" ] || { echo "Укажите файл копии: bash deploy/restore.sh backups/….dump" >&2; ls -1t backups/*.dump 2>/dev/null | head -5; exit 2; }
COMPOSE=(docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml)
grep -q '^DOMAIN=.' .env 2>/dev/null || COMPOSE=(docker compose)
read -r -p "Заменить текущие данные копией $(basename "$f")? Напишите ДА: " ans
[ "$ans" = "ДА" ] || { echo "Отменено"; exit 1; }
echo "▸ Копия текущего состояния"; bash deploy/backup.sh
echo "▸ Останавливаю сервер"; "${COMPOSE[@]}" stop api
echo "▸ Восстанавливаю"; "${COMPOSE[@]}" exec -T db pg_restore -U triosteum_owner -d triosteum --clean --if-exists --no-owner --role=triosteum_owner < "$f"
echo "▸ Запускаю сервер"; "${COMPOSE[@]}" start api
echo "▸ Готово"
