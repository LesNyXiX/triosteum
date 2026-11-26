CREATE TABLE quality_settings (
  org_id uuid NOT NULL,
  space_id text NOT NULL,
  reviewer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  threshold numeric(5,2) NOT NULL CHECK (threshold BETWEEN 0 AND 100),
  due_hours integer NOT NULL CHECK (due_hours BETWEEN 1 AND 720),
  contributors jsonb NOT NULL DEFAULT '[]',
  import_map jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (org_id, space_id),
  FOREIGN KEY (org_id, space_id) REFERENCES spaces(org_id, id) ON DELETE CASCADE
);

CREATE TABLE quality_cases (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id uuid NOT NULL,
  space_id text NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  article text NOT NULL,
  lot text NOT NULL,
  article_key text NOT NULL,
  lot_key text NOT NULL,
  inspected integer NOT NULL CHECK (inspected > 0),
  defects integer NOT NULL CHECK (defects BETWEEN 0 AND inspected),
  note text NOT NULL,
  photo bytea,
  photo_type text,
  status text NOT NULL CHECK (status IN ('within_limit', 'pending', 'returned', 'approved', 'rejected')),
  threshold numeric(5,2) NOT NULL,
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revision integer NOT NULL DEFAULT 1,
  history jsonb NOT NULL DEFAULT '[]',
  FOREIGN KEY (org_id, space_id) REFERENCES quality_settings(org_id, space_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX quality_case_lot ON quality_cases (org_id, space_id, article_key, lot_key);
CREATE INDEX quality_case_register ON quality_cases (org_id, space_id, id DESC);

ALTER TABLE quality_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON quality_settings USING (org_id = app_org()) WITH CHECK (org_id = app_org());
ALTER TABLE quality_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_cases FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON quality_cases USING (org_id = app_org()) WITH CHECK (org_id = app_org());
GRANT SELECT, INSERT, UPDATE ON quality_settings, quality_cases TO triosteum_app;
