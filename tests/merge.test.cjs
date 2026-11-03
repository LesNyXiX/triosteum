// Проверки трёхстороннего слияния правок (src/app/core/merge.js). Запуск: node tests/merge.test.cjs
const fs = require('fs'); eval(fs.readFileSync(require('path').join(__dirname, '..', 'src', 'app', 'core', 'merge.js'), 'utf8').replace(/^  /gm, '') + '; global.merge3 = merge3;');
const assert = require('assert');
const base = { seq: 5, cam: { x: 0 }, nodes: [{ id: 'n1', name: 'A', x: 0 }, { id: 'n2', name: 'B', x: 0 }], edges: [{ id: 'e1', from: 'n1', to: 'n2' }], notes: [] };
const J = (o) => JSON.parse(JSON.stringify(o));
// 1. разные блоки двигали двое
let mine = J(base); mine.nodes[0].x = 100; mine.cam.x = 50;
let theirs = J(base); theirs.nodes[1].x = 200; theirs.cam.x = 999;
let m = merge3(base, mine, theirs);
assert.equal(m.nodes[0].x, 100); assert.equal(m.nodes[1].x, 200); assert.equal(m.cam.x, 50);
// 2. разные свойства одного блока
mine = J(base); mine.nodes[0].name = 'Мой'; theirs = J(base); theirs.nodes[0].x = 7;
m = merge3(base, mine, theirs); assert.deepEqual(m.nodes[0], { id: 'n1', name: 'Мой', x: 7 });
// 3. оба добавили блоки (разные id) + seq
mine = J(base); mine.nodes.push({ id: 'n5_ab', name: 'M' }); mine.seq = 6;
theirs = J(base); theirs.nodes.push({ id: 'n5_cd', name: 'T' }); theirs.seq = 6;
m = merge3(base, mine, theirs); assert.deepEqual(m.nodes.map((n) => n.id).sort(), ['n1', 'n2', 'n5_ab', 'n5_cd']); assert.equal(m.seq, 6);
// 4. они удалили блок, мы не трогали → удалён; мы удалили связь, они не трогали → удалена
mine = J(base); mine.edges = []; theirs = J(base); theirs.nodes = theirs.nodes.filter((n) => n.id !== 'n2');
m = merge3(base, mine, theirs); assert.deepEqual(m.nodes.map((n) => n.id), ['n1']); assert.deepEqual(m.edges, []);
// 5. они удалили блок, а мы его изменили → блок остаётся
mine = J(base); mine.nodes[1].name = 'Важное'; theirs = J(base); theirs.nodes = [theirs.nodes[0]];
m = merge3(base, mine, theirs); assert.ok(m.nodes.find((n) => n.id === 'n2' && n.name === 'Важное'));
// 6. одно и то же свойство — наше
mine = J(base); mine.nodes[0].name = 'М'; theirs = J(base); theirs.nodes[0].name = 'Т';
assert.equal(merge3(base, mine, theirs).nodes[0].name, 'М');
// 7. вложенные карты (ячейки таблицы)
const fb = { files: { items: [{ id: 'f1', data: { sheets: [{ id: 's1', cells: { A1: '1', B1: '2' } }] } }], open: ['f1'] } };
mine = J(fb); mine.files.items[0].data.sheets[0].cells.A1 = 'мой'; mine.files.open = ['f1', 'f2'];
theirs = J(fb); theirs.files.items[0].data.sheets[0].cells.B1 = 'их'; theirs.files.open = [];
m = merge3(fb, mine, theirs); assert.deepEqual(m.files.items[0].data.sheets[0].cells, { A1: 'мой', B1: 'их' }); assert.deepEqual(m.files.open, ['f1', 'f2']);
// 8. ничего не меняли мы — берём их целиком
assert.deepEqual(merge3(base, J(base), { ...J(base), seq: 9 }).seq, 9);
console.log('слияние: 8 проверок пройдено');
