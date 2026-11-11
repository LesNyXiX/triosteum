#!/usr/bin/env bash
# Включить Infinitum — собственный ИИ Triosteum — на этом сервере одной командой:
#
#   sudo bash deploy/infinitum.sh                 # модель подбирается под память сервера
#   sudo bash deploy/infinitum.sh --model qwen2.5:3b
#   sudo bash deploy/infinitum.sh --off           # выключить (модель остаётся на диске)
#
# Что делает: прописывает в .env AI_PROVIDER=openai, AI_MODEL и COMPOSE_PROFILES=ai, при нехватке памяти
# создаёт файл подкачки 2 ГБ, поднимает Ollama, скачивает модель и проверяет, что Infinitum отвечает.
# Повторный запуск безопасен.
set -euo pipefail

MODEL="" OFF=0
while [ $# -gt 0 ]; do
  case "$1" in
    --model) MODEL="${2:-}"; shift 2 ;;
    --off) OFF=1; shift ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) echo "Неизвестный параметр: $1" >&2; exit 2 ;;
  esac
done
[ "$(id -u)" -eq 0 ] || { echo "Запустите через sudo" >&2; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
[ -f .env ] || { echo "Нет файла .env — сначала установите Triosteum (deploy/install.sh)" >&2; exit 1; }
say() { printf '\n\033[1;31m▸\033[0m %s\n' "$*"; }
COMPOSE=(docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml)

# последняя строка .env без перевода строки — новая настройка приклеилась бы к ней
[ -z "$(tail -c1 .env)" ] || printf '\n' >> .env
setenv() {  # setenv КЛЮЧ ЗНАЧЕНИЕ — заменить или дописать
  local k="$1" v="$2"
  if grep -q "^${k}=" .env; then
    local tmp; tmp="$(mktemp)"
    awk -v k="$k" -v v="$v" 'index($0, k"=") == 1 {print k"="v; next} {print}' .env > "$tmp" && cat "$tmp" > .env && rm -f "$tmp"
  else
    printf '%s=%s\n' "$k" "$v" >> .env
  fi
}

if [ "$OFF" = 1 ]; then
  say "Выключаю Infinitum"
  setenv AI_PROVIDER ""
  setenv COMPOSE_PROFILES ""
  "${COMPOSE[@]}" up -d --remove-orphans
  "${COMPOSE[@]}" --profile ai stop ollama >/dev/null 2>&1 || true
  echo "  Готово: ИИ на сервере выключен. Пользователи могут подключать локальный ИИ или ИИ по API."
  exit 0
fi

# ---- 1. Модель под память сервера ----
MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if [ -z "$MODEL" ]; then
  if   [ "$MEM_MB" -ge 30000 ]; then MODEL="qwen2.5-coder:14b"
  elif [ "$MEM_MB" -ge 14000 ]; then MODEL="qwen2.5-coder:7b"
  elif [ "$MEM_MB" -ge 7000 ];  then MODEL="qwen2.5:3b"
  else MODEL="qwen2.5:1.5b"; fi
fi
LIMIT_MB=$(( MEM_MB * 65 / 100 ))
say "Память сервера: ${MEM_MB} МБ, ядер: $(nproc). Модель Infinitum: ${MODEL}"

# ---- 2. Подкачка: страховка от нехватки памяти на маленьком сервере ----
if [ "$MEM_MB" -lt 8000 ] && ! swapon --show | grep -q .; then
  say "Создаю файл подкачки 2 ГБ (/swapfile)"
  fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
  chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ---- 3. Настройки и запуск ----
say "Прописываю настройки в .env"
setenv COMPOSE_PROFILES ai
setenv AI_PROVIDER openai
setenv AI_MODEL "$MODEL"
setenv OLLAMA_MEM_LIMIT "${LIMIT_MB}m"
chmod 600 .env
say "Запускаю Ollama и перезапускаю сервер"
"${COMPOSE[@]}" up -d --build

# ---- 4. Модель ----
say "Скачиваю модель ${MODEL} (несколько минут, один раз)"
for i in 1 2 3 4 5 6 7 8 9 10; do "${COMPOSE[@]}" exec -T ollama ollama list >/dev/null 2>&1 && break; sleep 3; done
"${COMPOSE[@]}" exec -T ollama ollama pull "$MODEL"

# ---- 5. Проверка ----
say "Проверяю, что Infinitum отвечает (первый ответ на процессоре — до минуты)"
ANSWER=$("${COMPOSE[@]}" exec -T ollama ollama run "$MODEL" "Ответь одним словом по-русски: готово" 2>/dev/null | head -c 200 || true)
if [ -n "$ANSWER" ]; then
  echo "  Модель ответила: ${ANSWER}"
  printf '\n\033[1;32m✓ Infinitum включён.\033[0m Обновите страницу Triosteum (Ctrl+F5): в шапке переключатель ИИ → «Infinitum».\n'
else
  echo "  Модель не ответила. Посмотрите журнал: ${COMPOSE[*]} logs --tail=50 ollama" >&2
  exit 1
fi
