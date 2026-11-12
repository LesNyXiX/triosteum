-- Мастерская компании: журнал и откат доработок (плагины, свои среды, расширения), а для плагинов и расширений —
-- выключение для всей компании одним действием.
ALTER TABLE org_items ADD COLUMN IF NOT EXISTS disabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS org_item_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  item_id     uuid NOT NULL REFERENCES org_items(id) ON DELETE CASCADE,
  action      text NOT NULL CHECK (action IN ('publish', 'update', 'rollback', 'disable', 'enable', 'remove')),
  name        text NOT NULL,
  data        jsonb,                      -- снимок для publish / update / rollback (старые снимки со временем очищаются)
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS org_item_versions_item_idx ON org_item_versions (org_id, item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS org_item_versions_org_idx ON org_item_versions (org_id, created_at DESC);

ALTER TABLE org_item_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_item_versions FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_item_versions' AND policyname = 'org_isolation') THEN
    CREATE POLICY org_isolation ON org_item_versions USING (org_id = app_org()) WITH CHECK (org_id = app_org());
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON org_item_versions TO triosteum_app;

-- то, что уже опубликовано, — первая запись истории
INSERT INTO org_item_versions (org_id, item_id, action, name, data, created_by, created_at)
SELECT i.org_id, i.id, 'publish', i.name, i.data, coalesce(i.updated_by, i.created_by), i.updated_at
FROM org_items i
WHERE i.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM org_item_versions v WHERE v.item_id = i.id);
