# Сервер Triosteum

FastAPI + PostgreSQL. Отдаёт приложение (`docs/index.html`) вошедшим пользователям вместе с их данными. Хранит пространства с историей версий и личные настройки, ведёт журнал действий. Организации изолированы друг от друга на уровне базы (Row Level Security).

Контракт API описан в [`API.md`](API.md), документация в браузере — `/api/docs`.

## Запуск одной командой (Docker)

```bash
cp .env.example .env          # в корне репозитория; поменяйте пароли
docker compose up -d --build
```

Откройте http://localhost:8000, зарегистрируйте организацию и войдите. При запуске сервер сам применяет новые миграции из `server/db/`.

## Запуск для разработки (без Docker)

Нужны Python 3.11+ и PostgreSQL 16.

```bash
cd server
python -m venv .venv && . .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt

# база и миграции (владельцем базы)
createdb triosteum
MIGRATE_DATABASE_URL=postgresql://postgres@localhost/triosteum APP_DB_PASSWORD=app python -m app.migrate

# сервер (ролью приложения)
DATABASE_URL=postgresql+psycopg://triosteum_app:app@localhost/triosteum COOKIE_SECURE=0 uvicorn app.main:app --reload
```

Чтобы правки интерфейса были видны сразу, в корне репозитория держите запущенным `npm run dev`: сервер перечитывает `docs/index.html` при изменении.

## Проверки

```bash
cd server
TEST_ADMIN_URL=postgresql://postgres@localhost/postgres pytest     # 38 тестов API на временной базе
cd .. && TRIOSTEUM_URL=http://localhost:8000 npm run test:server   # сквозная проверка в браузере
TRIOSTEUM_URL=http://localhost:8000 node tests/team-e2e.mjs         # команда и история версий в браузере
```

Тесты API проверяют вход и выход, правила регистрации, хранение паролей (argon2id), ограничение попыток входа (в том числе с подставным X-Forwarded-For), сохранение с номером правки и конфликт, переименование и удаление, историю версий. Ещё они проверяют изоляцию организаций (через API и прямым SQL), права наблюдателя, защиту от CSRF, лимит размера запроса, экранирование данных в странице, настройки, перенос из браузера и журнал.

## Настройки (переменные окружения)

| Переменная | Что это | По умолчанию |
|---|---|---|
| `DATABASE_URL` | подключение ролью `triosteum_app` | — |
| `MIGRATE_DATABASE_URL` | подключение владельцем схемы; если задано, миграции применяются при запуске | — |
| `APP_DB_PASSWORD` | пароль, который миграции ставят роли `triosteum_app` | — |
| `COOKIE_SECURE` | cookie только по HTTPS | `1` |
| `TRUST_PROXY` | доверять `X-Forwarded-For` (только за своим nginx/caddy) | `0` |
| `ALLOWED_ORIGINS` | дополнительные адреса, с которых разрешены изменяющие запросы | — |
| `SESSION_DAYS` | срок жизни входа | `30` |
| `MAX_BODY_MB` | максимальный размер запроса | `20` |
| `VERSION_EVERY_SEC` | как часто делать автоснимок пространства | `600` |
| `LOGIN_ATTEMPTS_PER_MIN` | попыток входа в минуту на IP и на почту | `10` |
| `CLIENT_HTML` | путь к собранному приложению | `../docs/index.html` |

## ИИ

Окна «AI», «Конструктор», «Целостный код схемы», ИИ у блока и ИИ-помощник Офиса работают через сервер: браузер отправляет задачу на `/api/ai/complete`, а сервер обращается к модели. Модель задаётся в `.env`:

| Вариант | Настройки | Особенности |
|---|---|---|
| Своя модель (Ollama, vLLM) | `AI_PROVIDER=openai`, `AI_MODEL=qwen2.5-coder:14b`, `AI_BASE_URL` (по умолчанию контейнер `ollama`) | Бесплатно, данные не покидают сервер. Нужна видеокарта или много памяти. Запуск: `docker compose --profile ai up -d`, затем `docker compose exec ollama ollama pull qwen2.5-coder:14b` |
| YandexGPT | `AI_PROVIDER=yandex`, `YANDEX_API_KEY`, `YANDEX_FOLDER_ID`, `AI_MODEL=yandexgpt` | Ключ сервисного аккаунта с ролью `ai.languageModels.user` в Yandex AI Studio. Адаптер пока не проверен на настоящем ключе |
| Заглушка | `AI_PROVIDER=echo` | Для проверок |
| Выключен | `AI_PROVIDER=` | В окнах ИИ появится пояснение |

У каждой организации есть месячный лимит токенов (`organizations.ai_budget_tokens`, по умолчанию 2 млн), расход виден владельцу в окне «Команда».

## Продакшен

- Поставьте перед сервером nginx или caddy с HTTPS, а в `.env` задайте `COOKIE_SECURE=1` и `TRUST_PROXY=1`.
- Хостинг — в России (Yandex Cloud, Selectel, cloud.ru), так требует 152-ФЗ. Подробности — в документе «Triosteum: план и архитектура сервера».
- Делайте резервные копии базы (`pg_dump` или средства облака) и регулярно проверяйте восстановление из них.
- Миграции запускайте суперпользователем (в docker-compose так и есть). Новые таблицы роль приложения получает автоматически, а для таблиц с `org_id` нужно включить политику `org_isolation`.

## Что дальше

- Отправка приглашений письмом (сейчас владелец копирует ссылку сам).
- Проверить адаптер YandexGPT на настоящем ключе, добавить GigaChat.
- Совместная правка в реальном времени (WebSocket + Yjs).
