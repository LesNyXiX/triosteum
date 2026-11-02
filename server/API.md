# API сервера Triosteum

Этот API реализует сервер на FastAPI (`server/app/main.py`, проверки — `server/tests`). Браузерная часть уже работает с ним через `src/app/core/server-adapter.js`. Эталон поведения — тестовый сервер `tests/mock-server.mjs`: если сомневаетесь, как ответить, смотрите туда.

Все ответы приходят в JSON. Ошибки имеют вид `{"detail": "текст для человека"}`. Вход хранится в cookie `tsid` (HttpOnly, SameSite=Lax, Secure в продакшене). В базе лежит только SHA-256 токена.

## Страницы

| Запрос | Ответ |
|---|---|
| `GET /` | Если не выполнен вход — 302 на `/login`. Иначе `docs/index.html`, где метка `<!--@@BOOT@@-->` заменена на `<script>window.TRIOSTEUM_BOOT = {…}</script>` (в JSON экранировать `<` как `<`). |
| `GET /login` | `server/app/static/login.html` |

Содержимое `TRIOSTEUM_BOOT`:

```json
{
  "user":  { "id": "…", "email": "ivan@zavod.ru", "name": "Иван" },
  "org":   { "id": "…", "name": "Завод" },
  "role":  "owner | editor | approver | viewer",
  "cur":   "id последнего открытого пространства или null (настройка cur)",
  "prefs": { "ui": {…}, "my": […], "lang.code": "python", … },
  "spaces": [ { "id": "p1", "name": "Цех 3", "env": "code", "rev": 4, "updated_at": "ISO", "updated_by_name": "Иван", "content": {…} } ]
}
```

## Вход

| Запрос | Тело | Ответ |
|---|---|---|
| `POST /api/auth/register` | `{org, name, email, password, pd_consent: true}` | 201 + cookie. Создаёт организацию, пользователь становится её владельцем. 409 — почта занята, 422 — нет согласия или короткий пароль. |
| `POST /api/auth/login` | `{email, password}` | 200 + cookie. 401 `Неверная почта или пароль` (одинаковый текст для любой ошибки). |
| `POST /api/auth/logout` | — | 200, сессия удаляется, cookie стирается. |
| `GET /api/me` | — | `{user, org, role}` |

Пароли хранятся в виде хеша argon2id. Нужно ограничить число попыток входа: не больше 10 в минуту с одного IP и на одну почту. Сессия живёт 30 дней.

## Пространства

| Запрос | Тело | Ответ |
|---|---|---|
| `GET /api/spaces/{id}` | — | пространство целиком, как в `spaces[]` |
| `PUT /api/spaces/{id}` | `{name, env, content, base_rev}` | Создаёт пространство (если `base_rev = 0` и его нет) или сохраняет новую версию. 201/200 `{rev, updated_at}`. Если `base_rev` не совпадает с текущим `rev`, отвечает **409** с текущим пространством целиком — браузер сам покажет конфликт и сохранит свою копию. |
| `PATCH /api/spaces/{id}` | `{name?, env?}` | переименование, смена среды |
| `DELETE /api/spaces/{id}` | — | мягкое удаление (`deleted_at`), 30 дней можно вернуть |
| `GET /api/spaces` | — | список пространств без содержимого |
| `GET /api/spaces/{id}/versions` | — | история версий: `[{id, rev, label, created_at, by}]` |
| `POST /api/spaces/{id}/versions` | `{label}` | сохранить текущую версию с подписью |
| `GET /api/spaces/{id}/versions/{vid}` | — | содержимое версии (для возврата) |

Права: `viewer` и `approver` получают 403 на PUT, PATCH и DELETE.

Снимки для истории версий пишутся в `space_versions` при сохранении, но не чаще раза в 10 минут на пространство. Вне очереди снимок делается через `POST /api/spaces/{id}/versions`.

Сохранение с проверкой версии делается одним запросом:

```sql
UPDATE spaces SET content = $1, rev = rev + 1, updated_by = $2, updated_at = now()
WHERE org_id = app_org() AND id = $3 AND rev = $4 AND deleted_at IS NULL
RETURNING rev, updated_at;
-- 0 строк → 409
```

## Команда

| Запрос | Тело | Ответ |
|---|---|---|
| `GET /api/org/members` | — | `{me, my_role, members: [{id, email, name, role, since, last_login}], invites: [...]}`. Приглашения видит только владелец. |
| `POST /api/org/invites` | `{email, role}` | Только владелец. Роль: `editor`, `approver` или `viewer`. Ответ: `{id, path: "/invite?t=…", expires_at}`. Ссылка одноразовая, живёт 7 дней, в базе хранится только хеш токена. |
| `DELETE /api/org/invites/{id}` | — | Отменить приглашение (владелец). |
| `PATCH /api/org/members/{user_id}` | `{role}` | Сменить роль (владелец). Последнего владельца понизить нельзя — 409. |
| `DELETE /api/org/members/{user_id}` | — | Убрать из организации (владелец). Его сессии в этой организации сразу закрываются. |
| `GET /api/invites/{token}` | — | Без входа: `{org, email, role, has_account}`. 404 — ссылка недействительна. |
| `POST /api/auth/accept-invite` | `{token, password, name?, pd_consent?}` | Новый человек получает аккаунт (нужно согласие на обработку ПД), у кого аккаунт уже есть, подтверждает его паролем. Ответ: 200 + cookie. |
| `GET /invite?t=…` | — | Страница принятия приглашения. |

Чтобы найти приглашение до входа, используется функция `invite_by_token` с правами владельца схемы (миграция 002). Поэтому миграции нужно запускать суперпользователем или ролью с `BYPASSRLS`.

## Настройки и перенос

| Запрос | Тело | Ответ |
|---|---|---|
| `PUT /api/prefs/{name}` | `{value}` | 200. Имя: `[A-Za-z0-9_.-]{1,80}`, значение — до 1 МБ. |
| `POST /api/import` | `{spaces: [{id, name, env, content}], prefs: {…}}` | `{spaces: N}`. Переносит данные из localStorage браузера. При совпадении id к нему добавляется суффикс. |

## Безопасность (обязательно)

- В каждой транзакции сначала выполнить `SELECT set_config('app.org_id', <org из сессии>, true)` и подключаться к базе ролью `triosteum_app`. Тогда построчная защита не даст увидеть чужие данные, даже если в коде ошибка.
- Для запросов, меняющих данные, проверять заголовок `Origin` (защита от CSRF). Cookie должна быть `SameSite=Lax`.
- Ограничить размер тела запроса (например, 20 МБ) и размер `content` пространства.
- Записывать в `audit_log` вход, удаление, импорт и выгрузку.

`GET /api/health` возвращает `{ok: true}`, если сервер и база работают.
