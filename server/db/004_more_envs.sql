-- Отраслевые среды: склад, производство, финансы, персонал, продажи, аналитика.
-- Вместо перечня — формат идентификатора, чтобы новые среды не требовали миграций.
ALTER TABLE spaces DROP CONSTRAINT IF EXISTS spaces_env_check;
ALTER TABLE spaces ADD CONSTRAINT spaces_env_check CHECK (env ~ '^[a-z]{2,12}$');
