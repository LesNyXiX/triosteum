-- Triosteum: начальная схема базы данных (PostgreSQL 16+)
-- Принцип: каждая строка с данными клиента принадлежит организации (org_id),
-- а база сама не отдаёт чужие строки — включена построчная защита (Row Level Security).
-- Приложение в начале каждой транзакции выполняет:  SELECT set_config('app.org_id', '<uuid>', true);

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid(), digest()

-- ---------- организации и люди ----------
CREATE TABLE organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  inn         text CHECK (inn ~ '^[0-9]{10}([0-9]{2})?$'),
  plan        text NOT NULL DEFAULT 'trial',
  ai_budget_tokens bigint NOT NULL DEFAULT 2000000,       -- месячный лимит токенов ИИ
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  name          text NOT NULL DEFAULT '',
  password_hash text,                      -- NULL, если человек входит только через корпоративный каталог
  disabled      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
CREATE UNIQUE INDEX users_email_uq ON users (lower(email));

CREATE TABLE memberships (
  org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('owner', 'editor', 'approver', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX memberships_user_idx ON memberships (user_id);

-- сессии входа: в базе только хеш токена, сам токен живёт в cookie браузера
CREATE TABLE sessions (
  token_hash  bytea PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  user_agent  text,
  ip          inet
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_exp_idx ON sessions (expires_at);

CREATE TABLE invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        text NOT NULL CHECK (role IN ('editor', 'approver', 'viewer')),
  token_hash  bytea NOT NULL UNIQUE,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  accepted_at timestamptz
);

-- ---------- пространства и их версии ----------
-- id пространства создаёт браузер (например 'pmh3k9x2a'), поэтому он текстовый и уникален внутри организации
CREATE TABLE spaces (
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  id          text NOT NULL CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  env         text NOT NULL DEFAULT 'code' CHECK (env IN ('code', 'docs')),
  content     jsonb NOT NULL DEFAULT '{}'::jsonb,   -- схема блоков и файлы офиса, как в браузере
  rev         integer NOT NULL DEFAULT 1,           -- номер правки: защита от затирания чужих изменений
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,                          -- удалённое пространство 30 дней можно вернуть
  PRIMARY KEY (org_id, id)
);
CREATE INDEX spaces_live_idx ON spaces (org_id, updated_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE space_versions (
  id          bigserial PRIMARY KEY,
  org_id      uuid NOT NULL,
  space_id    text NOT NULL,
  rev         integer NOT NULL,
  content     jsonb NOT NULL,
  label       text,                                 -- «Сохранить версию» с подписью; NULL — автоснимок
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (org_id, space_id) REFERENCES spaces(org_id, id) ON DELETE CASCADE,
  UNIQUE (org_id, space_id, rev)
);
CREATE INDEX space_versions_idx ON space_versions (org_id, space_id, created_at DESC);

-- ---------- личные настройки ----------
CREATE TABLE prefs (
  org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (name ~ '^[A-Za-z0-9_.-]{1,80}$'),
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id, name)
);

-- ---------- файлы, ИИ, журнал ----------
CREATE TABLE assets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  space_id    text,
  storage_key text NOT NULL,                        -- путь объекта в S3-хранилище
  mime        text NOT NULL,
  size_bytes  bigint NOT NULL CHECK (size_bytes >= 0),
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_requests (
  id          bigserial PRIMARY KEY,
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  task        text NOT NULL,                        -- 'architect', 'constructor', 'block', 'office'
  model       text NOT NULL,
  tokens_in   integer NOT NULL DEFAULT 0,
  tokens_out  integer NOT NULL DEFAULT 0,
  cost_rub    numeric(12, 4) NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_requests_month_idx ON ai_requests (org_id, created_at);

CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  action      text NOT NULL,                        -- 'login', 'space.update', 'space.delete', 'export'…
  object_type text,
  object_id   text,
  ip          inet,
  details     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_idx ON audit_log (org_id, created_at DESC);

-- ---------- построчная защита: организация видит только свои строки ----------
-- Функция возвращает организацию текущей транзакции (или NULL, если не задана — тогда не видно ничего).
CREATE FUNCTION app_org() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('app.org_id', true), '')::uuid $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['spaces', 'space_versions', 'prefs', 'assets', 'ai_requests', 'audit_log', 'invites'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);   -- действует и на владельца таблиц
    EXECUTE format('CREATE POLICY org_isolation ON %I USING (org_id = app_org()) WITH CHECK (org_id = app_org())', t);
  END LOOP;
END $$;

-- Роль, под которой работает приложение: без права обходить защиту и менять схему.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'triosteum_app') THEN
    CREATE ROLE triosteum_app LOGIN NOBYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO triosteum_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO triosteum_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO triosteum_app;
GRANT EXECUTE ON FUNCTION app_org() TO triosteum_app;
