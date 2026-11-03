#!/usr/bin/env bash
# Установка Triosteum на чистый сервер Ubuntu 22.04 / 24.04 одной командой:
#
#   sudo bash deploy/install.sh --domain triosteum.example.ru --email admin@example.ru
#
# Что делает: ставит Docker, настраивает зеркало образов (Docker Hub ограничивает доступ из России),
# создаёт .env со случайными паролями, включает брандмауэр, запускает Triosteum с HTTPS
# и ежедневную резервную копию базы. Повторный запуск безопасен: пароли в .env не меняются.
#
# Флаги:  --domain  адрес сайта (DNS-запись A уже должна указывать на этот сервер)
#         --email   почта для уведомлений Let's Encrypt о сертификате
#         --dry-run только подготовить .env и показать, что будет сделано
set -euo pipefail

DOMAIN="" EMAIL="" DRY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --email) EMAIL="${2:-}"; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "Неизвестный параметр: $1" >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
say() { printf '\n\033[1;31m▸\033[0m %s\n' "$*"; }
run() { if [ "$DRY" = 1 ]; then echo "  [пробный прогон] $*"; else "$@"; fi; }

[ -n "$DOMAIN" ] || { echo "Укажите домен: --domain triosteum.example.ru" >&2; exit 2; }
[ -n "$EMAIL" ]  || { echo "Укажите почту для сертификата: --email admin@example.ru" >&2; exit 2; }
echo "$DOMAIN" | grep -Eq '^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' || { echo "Домен выглядит неверно: $DOMAIN" >&2; exit 2; }
if [ "$DRY" = 0 ] && [ "$(id -u)" -ne 0 ]; then echo "Запустите через sudo" >&2; exit 1; fi

# ---- 1. Docker ----
if [ "$DRY" = 0 ] && ! command -v docker >/dev/null 2>&1; then
  say "Ставлю Docker"
  apt-get update -q
  DEBIAN_FRONTEND=noninteractive apt-get install -y -q docker.io docker-compose-v2 ufw openssl curl
  systemctl enable --now docker
fi
if [ "$DRY" = 0 ] && [ ! -s /etc/docker/daemon.json ]; then
  say "Настраиваю зеркало образов Docker"
  printf '{\n  "registry-mirrors": ["https://mirror.gcr.io"],\n  "log-driver": "json-file",\n  "log-opts": { "max-size": "20m", "max-file": "5" }\n}\n' > /etc/docker/daemon.json
  systemctl restart docker
fi

# ---- 2. Настройки (.env) ----
rnd() { openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c "${1:-32}"; }
setenv() {  # setenv КЛЮЧ ЗНАЧЕНИЕ [перезаписать]
  local k="$1" v="$2" force="${3:-0}"
  if grep -q "^${k}=" .env 2>/dev/null; then
    local cur; cur="$(grep "^${k}=" .env | head -1 | cut -d= -f2-)"
    if [ "$force" = 1 ] || [ -z "$cur" ] || echo "$cur" | grep -q 'поменяйте'; then
      local tmp; tmp="$(mktemp)"; awk -v k="$k" -v v="$v" 'BEGIN{FS=OFS="="} $1==k{print k"="v; next} {print}' .env > "$tmp" && cat "$tmp" > .env && rm -f "$tmp"
    fi
  else
    printf '%s=%s\n' "$k" "$v" >> .env
  fi
}
say "Готовлю .env"
[ -f .env ] || cp .env.example .env
chmod 600 .env
setenv DB_OWNER_PASSWORD "$(rnd 32)"
setenv APP_DB_PASSWORD "$(rnd 32)"
setenv RUNNER_TOKEN "$(rnd 40)"
setenv DOMAIN "$DOMAIN" 1
setenv ACME_EMAIL "$EMAIL" 1
setenv PUBLIC_URL "https://$DOMAIN" 1
setenv COOKIE_SECURE 1 1
setenv TRUST_PROXY 1 1
echo "  .env готов (пароли сгенерированы, файл доступен только root)"

# ---- 3. Брандмауэр ----
if [ "$DRY" = 0 ] && command -v ufw >/dev/null 2>&1; then
  say "Брандмауэр: открыты только SSH, HTTP и HTTPS"
  ufw allow OpenSSH >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443 >/dev/null
  ufw --force enable >/dev/null
fi

# ---- 4. Запуск ----
COMPOSE=(docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml)
say "Собираю и запускаю Triosteum (первый раз — несколько минут)"
run "${COMPOSE[@]}" up -d --build

# ---- 5. Резервные копии каждую ночь ----
say "Включаю ежедневную резервную копию базы (03:30)"
CRON="30 3 * * * root cd $ROOT && bash deploy/backup.sh >> /var/log/triosteum-backup.log 2>&1"
if [ "$DRY" = 1 ]; then echo "  [пробный прогон] /etc/cron.d/triosteum: $CRON"; else echo "$CRON" > /etc/cron.d/triosteum; chmod 644 /etc/cron.d/triosteum; fi

# ---- 6. Проверка ----
if [ "$DRY" = 0 ]; then
  say "Жду, пока Triosteum ответит"
  ok=0
  for _ in $(seq 1 60); do
    if curl -fsS http://127.0.0.1:8000/api/health >/dev/null 2>&1; then ok=1; break; fi
    sleep 3
  done
  if [ "$ok" = 1 ]; then
    say "Готово: https://$DOMAIN"
    echo "  Откройте адрес, зарегистрируйте организацию — вы станете её владельцем."
    echo "  Сертификат HTTPS появится в течение минуты после первого открытия."
  else
    echo "Сервер не ответил за 3 минуты. Журнал: ${COMPOSE[*]} logs --tail 100 api" >&2; exit 1
  fi
else
  say "Пробный прогон завершён: ничего не установлено и не запущено"
fi
