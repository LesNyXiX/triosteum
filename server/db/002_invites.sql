-- Приглашения в организацию.
-- Человек, открывший ссылку, ещё не вошёл — организация неизвестна, и построчная защита
-- не даст найти приглашение. Поэтому поиск по токену — отдельная функция с правами владельца схемы:
-- она возвращает только одно приглашение по точному хешу токена и ничего больше.
CREATE FUNCTION invite_by_token(h bytea)
RETURNS TABLE (id uuid, org_id uuid, org_name text, email text, role text, expires_at timestamptz, accepted_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.org_id, o.name, i.email, i.role, i.expires_at, i.accepted_at
  FROM invites i JOIN organizations o ON o.id = i.org_id
  WHERE i.token_hash = h
$$;
REVOKE ALL ON FUNCTION invite_by_token(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION invite_by_token(bytea) TO triosteum_app;

CREATE INDEX invites_org_idx ON invites (org_id, created_at DESC);

-- таблицы будущих миграций автоматически доступны роли приложения
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO triosteum_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO triosteum_app;
