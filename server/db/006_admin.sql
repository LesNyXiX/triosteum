-- Панель администратора сервера: настройки сервера, приглашения на сервер, журнал действий с отменой,
-- точки восстановления. Администратор — не роль в организации, а флаг пользователя: он управляет всем сервером.

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;   -- удалённый пользователь не входит; его можно вернуть

-- первый зарегистрированный человек на уже работающем сервере становится администратором
UPDATE users SET is_admin = true
WHERE id = (SELECT id FROM users ORDER BY created_at LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM users WHERE is_admin);

-- настройки сервера: registration ('open' | 'invite'), access ({"open": bool, "message": text})
CREATE TABLE IF NOT EXISTS instance_settings (
  key        text PRIMARY KEY CHECK (key ~ '^[a-z_]{1,40}$'),
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- приглашения на сервер: создать свою организацию (kind = 'org') или войти в существующую (kind = 'member').
-- Ссылку открывает человек без входа, поэтому таблица без построчной защиты: ищем только по хешу токена.
CREATE TABLE IF NOT EXISTS instance_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash  bytea NOT NULL UNIQUE,
  kind        text NOT NULL CHECK (kind IN ('org', 'member')),
  org_id      uuid REFERENCES organizations(id) ON DELETE CASCADE,
  role        text CHECK (role IN ('owner', 'editor', 'approver', 'viewer')),
  email       text,                                   -- если задана — ссылкой воспользуется только эта почта
  note        text,
  max_uses    integer NOT NULL DEFAULT 1 CHECK (max_uses BETWEEN 1 AND 1000),
  uses        integer NOT NULL DEFAULT 0,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  CHECK (kind = 'org' OR (org_id IS NOT NULL AND role IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS instance_invites_created_idx ON instance_invites (created_at DESC);

-- журнал действий администратора; undo — как отменить действие (NULL — отменить нельзя)
CREATE TABLE IF NOT EXISTS admin_actions (
  id         bigserial PRIMARY KEY,
  admin_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  action     text NOT NULL,
  summary    text NOT NULL,
  details    jsonb,
  undo       jsonb,
  undone_at  timestamptz,
  undone_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_actions_idx ON admin_actions (created_at DESC);

-- точки восстановления: снимок пользователей, участников организаций, пространств и настроек сервера
CREATE TABLE IF NOT EXISTS restore_points (
  id         bigserial PRIMARY KEY,
  label      text NOT NULL CHECK (length(label) BETWEEN 1 AND 200),
  note       text,
  kind       text NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual', 'auto')),
  stats      jsonb NOT NULL DEFAULT '{}'::jsonb,
  data       jsonb NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS restore_points_idx ON restore_points (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON instance_settings, instance_invites, admin_actions, restore_points TO triosteum_app;
GRANT USAGE, SELECT ON SEQUENCE admin_actions_id_seq, restore_points_id_seq TO triosteum_app;
