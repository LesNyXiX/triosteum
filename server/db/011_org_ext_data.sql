-- Общие данные расширения внутри компании (разрешение «org.storage»): справочники, общие настройки, отметки.
-- Ключ — в пределах одного расширения (ext_src — его id), видят все сотрудники организации, у которых оно включено.
CREATE TABLE IF NOT EXISTS org_ext_data (
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ext_src     text NOT NULL CHECK (ext_src ~ '^x[a-z0-9]{5,15}$'),
  key         text NOT NULL CHECK (length(key) BETWEEN 1 AND 100),
  value       jsonb NOT NULL,
  bytes       integer NOT NULL,
  updated_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, ext_src, key)
);
ALTER TABLE org_ext_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_ext_data FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_ext_data' AND policyname = 'org_isolation') THEN
    CREATE POLICY org_isolation ON org_ext_data USING (org_id = app_org()) WITH CHECK (org_id = app_org());
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON org_ext_data TO triosteum_app;
