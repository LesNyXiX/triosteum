-- Свои среды организации: хранятся в той же библиотеке компании, что и общие плагины.
ALTER TABLE org_items DROP CONSTRAINT IF EXISTS org_items_kind_check;
ALTER TABLE org_items ADD CONSTRAINT org_items_kind_check CHECK (kind IN ('plugin', 'env'));
