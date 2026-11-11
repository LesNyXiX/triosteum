-- Расписание запуска: общий захват срока. Пространство может быть открыто на нескольких компьютерах —
-- запуск по расписанию выполняет тот клиент, кто первым атомарно захватил этот срок (slot — время срока в мс).
CREATE TABLE schedule_claims (
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  space_id    text NOT NULL CHECK (space_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  slot        bigint NOT NULL,
  claimed_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  claimed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, space_id)
);
ALTER TABLE schedule_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_claims FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON schedule_claims USING (org_id = app_org()) WITH CHECK (org_id = app_org());
GRANT SELECT, INSERT, UPDATE, DELETE ON schedule_claims TO triosteum_app;
