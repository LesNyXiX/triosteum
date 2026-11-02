-- Проверка построчной защиты и номера правки. Запуск: psql -d <база> -f test_rls.sql (от имени владельца схемы)
\set ON_ERROR_STOP 1
BEGIN;
INSERT INTO organizations (id, name) VALUES ('11111111-1111-1111-1111-111111111111', 'Завод А'), ('22222222-2222-2222-2222-222222222222', 'Завод Б');
SET LOCAL ROLE triosteum_app;
SELECT set_config('app.org_id', '11111111-1111-1111-1111-111111111111', true);
INSERT INTO spaces (org_id, id, name, content) VALUES ('11111111-1111-1111-1111-111111111111', 'p1', 'Цех А', '{"nodes":[]}');
SELECT set_config('app.org_id', '22222222-2222-2222-2222-222222222222', true);
INSERT INTO spaces (org_id, id, name, content) VALUES ('22222222-2222-2222-2222-222222222222', 'p1', 'Цех Б', '{"nodes":[]}');
-- Б видит только своё
SELECT 'Б видит: ' || string_agg(name, ', ') AS check FROM spaces;
-- Б пытается записать строку от имени А — должно быть отказано
DO $$ BEGIN
  INSERT INTO spaces (org_id, id, name) VALUES ('11111111-1111-1111-1111-111111111111', 'hack', 'Чужое');
  RAISE EXCEPTION 'ОШИБКА: запись в чужую организацию прошла';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK: запись в чужую организацию запрещена';
END $$;
-- Б пытается изменить пространство А — 0 строк
UPDATE spaces SET name = 'взлом' WHERE org_id = '11111111-1111-1111-1111-111111111111';
-- без организации не видно ничего
SELECT set_config('app.org_id', '', true);
SELECT 'без организации видно строк: ' || count(*) AS check FROM spaces;
-- номер правки: обновление проходит только с актуальным rev
SELECT set_config('app.org_id', '11111111-1111-1111-1111-111111111111', true);
UPDATE spaces SET content = '{"nodes":[1]}', rev = rev + 1 WHERE id = 'p1' AND rev = 1 RETURNING 'первая правка, rev=' || rev AS check;
UPDATE spaces SET content = '{"nodes":[2]}', rev = rev + 1 WHERE id = 'p1' AND rev = 1 RETURNING 'ОШИБКА: устаревшая правка прошла' AS check;
SELECT 'А видит: ' || name || ', rev=' || rev AS check FROM spaces;
ROLLBACK;
