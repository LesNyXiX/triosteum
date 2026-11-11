-- Библиотека организации: плагины (а дальше — свои среды и расширения), общие для всех её сотрудников.
-- Другие организации их не видят: та же построчная защита, что у пространств.
CREATE TABLE IF NOT EXISTS org_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('plugin')),
  src         text NOT NULL CHECK (length(src) BETWEEN 1 AND 120),   -- откуда взят: id личного плагина автора
  name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  data        jsonb NOT NULL,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS org_items_src_idx ON org_items (org_id, kind, src) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS org_items_live_idx ON org_items (org_id, kind, updated_at DESC) WHERE deleted_at IS NULL;

ALTER TABLE org_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_items FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_items' AND policyname = 'org_isolation') THEN
    CREATE POLICY org_isolation ON org_items USING (org_id = app_org()) WITH CHECK (org_id = app_org());
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON org_items TO triosteum_app;
