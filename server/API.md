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
| `POST /api/auth/forgot` | `{email}` | Всегда `{ok: true}`, есть такая почта или нет. Если есть — в фоне уходит письмо со ссылкой `/reset?t=…` (одноразовая, 1 час). 503 — почта не настроена. |
| `POST /api/auth/reset` | `{token, password}` | Новый пароль: все прежние входы закрываются, пользователь сразу входит. 404 — ссылка недействительна. |
| `GET /api/auth/options` | — | `{mail}` — умеет ли сервер отправлять письма |
| `GET /reset?t=…` | — | Страница «Новый пароль» |

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
| `POST /api/spaces/{id}/schedule-claim` | `{slot, token?}` | захват срока запуска по расписанию (`slot` — время срока в мс, `token` — метка вкладки): `{ok:true}` — запускает этот клиент, `{ok:false}` — срок уже взял другой. Повтор того же срока с тем же `token` подтверждается (ответ мог потеряться); невыполненный захват старше 10 минут можно взять заново. Только редактор и выше |

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
| `POST /api/org/invites` | `{email, role}` | Только владелец. Роль: `editor`, `approver` или `viewer`. Ответ: `{id, path: "/invite?t=…", expires_at, emailed, mail_error}`. Если почта настроена, приглашение сразу уходит письмом. Ссылка одноразовая, живёт 7 дней, в базе хранится только хеш токена. |
| `DELETE /api/org/invites/{id}` | — | Отменить приглашение (владелец). |
| `PATCH /api/org/members/{user_id}` | `{role}` | Сменить роль (владелец). Последнего владельца понизить нельзя — 409. |
| `DELETE /api/org/members/{user_id}` | — | Убрать из организации (владелец). Его сессии в этой организации сразу закрываются. |
| `GET /api/invites/{token}` | — | Без входа: `{org, email, role, has_account}`. 404 — ссылка недействительна. |
| `POST /api/auth/accept-invite` | `{token, password, name?, pd_consent?}` | Новый человек получает аккаунт (нужно согласие на обработку ПД), у кого аккаунт уже есть, подтверждает его паролем. Ответ: 200 + cookie. |
| `GET /invite?t=…` | — | Страница принятия приглашения. |

Чтобы найти приглашение до входа, используется функция `invite_by_token` с правами владельца схемы (миграция 002). Поэтому миграции нужно запускать суперпользователем или ролью с `BYPASSRLS`.

## ИИ

| Запрос | Тело | Ответ |
|---|---|---|
| `GET /api/ai/status` | — | `{enabled, provider, model, used_tokens, budget_tokens}` — расход организации за текущий месяц |
| `POST /api/ai/complete` | `{prompt, task, max_tokens?}` | Ответ модели потоком `text/plain` по мере генерации. Если модель ответила ошибкой, в конце потока приходит строка `\n\u0000ERR:<текст>`. 503 — ИИ не подключён, 402 — месячный лимит организации исчерпан, 429 — больше 20 запросов в минуту, 403 — наблюдателю недоступно. |

В `TRIOSTEUM_BOOT.ai` передаётся `{enabled, provider, model}`: по нему браузер решает, работает ли ИИ. Каждый запрос записывается в `ai_requests` (задача, модель, токены). Модель выбирается переменной `AI_PROVIDER` (см. `server/app/ai.py`).

## Запуск Python

| Запрос | Тело | Ответ |
|---|---|---|
| `POST /api/run/python` | `{code, input, mode}` | `mode=block` — вызвать последнюю функцию с `@block` на `input` (или на тестовых данных блока); `mode=script` — выполнить код целиком. Ответ: `{ok, stdout, stderr, output?, block?, error?, ms}`. 503 — исполнитель не подключён, 403 — наблюдателю недоступно, 429 — больше 30 запусков в минуту. |

В `TRIOSTEUM_BOOT.runner.enabled` браузер получает, доступен ли запуск на сервере. Если да, то редактор кода, запуск схемы и «Целостный код схемы» выполняют Python на сервере, а не в браузере (Pyodide). Маршруты среды «Офис» пока выполняют Python в браузере.

## Совместная работа (WebSocket)

`WS /api/ws/spaces/{id}` — комната пространства. Вход по той же cookie, подключения с чужого `Origin` отклоняются. Сообщения JSON:

| Направление | Сообщение | Смысл |
|---|---|---|
| сервер → | `{t:"hello", sid, color, peers:[…]}` | вы в комнате; `sid` — номер вкладки, его нужно передавать в заголовке `X-Live-Sid` при сохранении, тогда своя правка не вернётся обратно |
| сервер → | `{t:"join"|"leave", sid, …}` | кто-то вошёл или вышел |
| ↔ | `{t:"presence", cursor:{x,y}|null, sel:[id…]}` | курсор в координатах доски и выделенные объекты; сервер пересылает только эти поля |
| сервер → | `{t:"rev", rev, by, uid, content, updated_at}` | после каждого `PUT /api/spaces/{id}` — новая правка всем, кроме сохранившей вкладки |
| ↔ | `{t:"ping"}` / `{t:"pong"}` | проверка связи |

Если участника убирают из организации, его соединения закрываются (код 4403). Комнаты хранятся в памяти одного процесса сервера. Для нескольких процессов нужна общая шина (Redis pub/sub) — точка подключения `hub.publish_rev()` в `server/app/live.py`.

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


## Панель администратора

Администратор сервера — пользователь с флагом `users.is_admin` (первый зарегистрированный на сервере; на уже работающем сервере миграция `006_admin.sql` назначает самого раннего пользователя). В `TRIOSTEUM_BOOT.user` есть `is_admin`, у администратора ещё `instance: {registration, access}`. Все запросы `/api/admin/*` — только для администратора (иначе 403).

| Запрос | Что делает |
|---|---|
| `GET /api/admin/overview` | Пользователи, организации, пространства, кто в сети, размер базы и диска, активность за 14 дней |
| `POST /api/admin/registration` `{mode: "open"\|"invite"}` | Регистрация для всех или только по приглашению |
| `POST /api/admin/access` `{open, message}` | Закрыть вход всем, кроме администраторов: остальные получают **423** с причиной, `/` ведёт на `/login?closed=1` |
| `GET /api/admin/users`, `GET /api/admin/orgs` | Все пользователи (организации, роли, в сети) и организации |
| `POST /api/admin/users/{id}/disable` · `/enable` · `DELETE /api/admin/users/{id}` · `POST …/restore` · `POST`/`DELETE …/admin` | Отключить вход, удалить (мягко, можно вернуть), права администратора |
| `DELETE /api/admin/users/{id}/purge` | Удалить навсегда (только удалённого); пустые организации уходят вместе с ним |
| `GET`/`POST /api/admin/invites`, `DELETE /api/admin/invites/{id}` | Ссылки `/join?t=…`: `kind: "org"` — создать организацию, `"member"` — войти в `org_id` с `role`; `email`, `max_uses`, `days` |
| `GET /api/admin/actions`, `POST /api/admin/actions/{id}/undo` | Журнал; отмена выполняет обратное действие и пишет его в журнал (отмену можно вернуть) |
| `GET`/`POST /api/admin/points`, `POST /api/admin/points/{id}/restore`, `DELETE /api/admin/points/{id}` | Точки восстановления: снимок пользователей, участников, пространств и настроек; перед возвратом сохраняется точка «Перед восстановлением» |

Приглашения на сервер принимают `GET /api/join/{token}`, `POST /api/auth/register` с полем `invite` (kind `org`) и `POST /api/auth/join` (kind `member`). `GET /api/auth/options` сообщает `registration` и `access`.

## Задачи для ИИ (только администратор)

Окно «Задачи для ИИ» в панели администратора. Задачи хранятся как задачи (Issues) GitHub с меткой «ии-задача»:
Claude получает их через `.github/workflows/claude.yml` (упоминание `@claude`, по подписке владельца),
Codex — через своё приложение GitHub (комментарий `@codex …`). Нужен `AGENTS_GITHUB_TOKEN` в `.env`
(fine-grained токен владельца: только этот репозиторий, Issues — Read and write). Токен в браузер не уходит.

| Метод | Путь | Что делает |
|---|---|---|
| GET | `/api/admin/agents` | `{configured, repo, tasks:[{number,title,state,url,comments,created_at,updated_at}]}` |
| POST | `/api/admin/agents` | `{text, title?, claude, codex}` → новая задача, 201 |
| GET | `/api/admin/agents/{n}` | задача + `messages:[{who: owner/claude/codex/system, to, text, at, edited, url}]` + `prs` |
| POST | `/api/admin/agents/{n}/messages` | `{text, claude, codex}` — уточнение адресатам, 201 |
| POST | `/api/admin/agents/{n}/state` | `{open}` — закрыть или открыть снова |

## Библиотека организации

Общие плагины компании: сотрудник делится своим плагином — он появляется в библиотеке у всех сотрудников организации
(раздел «Компания»). Другие организации их не видят (построчная защита по `org_id`). Приходят и в данных страницы (`org_items`).

| Метод | Путь | Кто | Что делает |
|---|---|---|---|
| GET | `/api/org/items?kind=plugin` | все сотрудники | `{items:[{id, kind, src, name, data, by, by_name, updated_at}]}` |
| POST | `/api/org/items` | владелец, редактор | `{kind:"plugin", src, data}` — поделиться; тот же `src` — обновить (только автор или владелец), 201 |
| DELETE | `/api/org/items/{id}` | автор, владелец | убрать из библиотеки |

Свои среды компании — тот же API с `kind:"env"`: `src` и `data.id` — идентификатор среды `u[a-z]{5,11}`,
`data`: `{id, name, short, color:"#rrggbb", ic, desc, kinds:[типы блоков отраслевых сред], step, theme?}`.
Пространства в такой среде — обычные пространства с `env` = идентификатор среды.
