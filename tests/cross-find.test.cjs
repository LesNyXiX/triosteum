// Exact references must not pull unrelated fuzzy matches into an executable graph.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/app/workspace/cross-run.js'), 'utf8');
const ctx = vm.createContext({ nodeCode() {}, openBlock() {} });
vm.runInContext(source, ctx);
const item = (name, sp = 'office', kind = 'file') => ({ name, sp, kind, envName: 'Офис' });
let index = [item('Бюджет отдела'), item('Отчёт об исполнении бюджета'), item('Вне бюджета', 'finance', 'node')];
ctx.xIndex = () => index;
const names = (prompt, opts) => Array.from(ctx.xFind(prompt, opts), x => x.name);
assert.deepEqual(names('Используй «Бюджет отдела» и «Отчёт об исполнении бюджета» из Офиса.'),
  ['Бюджет отдела', 'Отчёт об исполнении бюджета']);
assert.deepEqual(names('Используй Бюджет отдела и Отчёт об исполнении бюджета'),
  ['Бюджет отдела', 'Отчёт об исполнении бюджета']);
assert.deepEqual(names('Используй «Бюджет отсутствует»'), [], 'missing quoted name must not select a similar block');
assert.deepEqual(names('Используй «Бюджет отдела» и «Несуществующий отчёт»'), ['Бюджет отдела']);
index = [item('Остатки на складах'), item('Расчёт дефицита', 'sales', 'node'), item('Остатки на складе', 'other')];
assert.deepEqual(names('Возьми таблицу «Остатки на складах» и расчёт дефицита из других пространств'),
  ['Остатки на складах', 'Расчёт дефицита'], 'quoted and unquoted exact references can be mixed');
index = [item('Остатки на складах')];
assert.deepEqual(names('Остатки на разных складах'), ['Остатки на складах'], 'unquoted fuzzy-only requests still work');
index = [item('Бюджет')];
assert.deepEqual(names('«Бюджет отсутствует»'), [], 'a fragment inside an unknown quoted name is not an exact match');
index = [item('Отчёт отдела')];
assert.deepEqual(names('Используй "ОТЧЕТ ОТДЕЛА"'), ['Отчёт отдела'], 'case and ё normalization');
index = [{ ...item('Бюджет отдела'), here: true }];
assert.deepEqual(names('«Бюджет отдела»'), [], 'current space excluded by default');
assert.deepEqual(names('«Бюджет отдела»', { withHere: true }), ['Бюджет отдела']);
index = [item('Финансы', 'finance', 'space'), item('Долги', 'finance', 'node'), item('Вне бюджета', 'other', 'node')];
assert.deepEqual(names('Возьми пространство «Финансы» и блок «Долги»'), ['Финансы'], 'whole space absorbs its blocks');
console.log('cross-find: 11 regression checks passed');
