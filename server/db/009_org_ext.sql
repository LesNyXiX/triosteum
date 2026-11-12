-- Расширения компании: код в песочнице, который добавляет в Triosteum свои команды и панели.
-- Хранятся в той же библиотеке компании; публикует только владелец организации.
ALTER TABLE org_items DROP CONSTRAINT IF EXISTS org_items_kind_check;
ALTER TABLE org_items ADD CONSTRAINT org_items_kind_check CHECK (kind IN ('plugin', 'env', 'ext'));
