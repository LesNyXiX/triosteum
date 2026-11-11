// UI и реальные Python-функции. Вместо загрузки Pyodide мост выполняет те же Python-строки в CPython.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const html = readFileSync(new URL('../docs/index.html', import.meta.url));
const python = process.env.PYTHON || 'python3';
const probe = spawnSync(python, ['--version']);
if (probe.status !== 0) throw new Error('Для проверки Python укажите PYTHON или установите python3');
let pythonRuns = 0;
const srv = createServer(async (req, res) => {
  if (req.url !== '/python') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); return; }
  let body = ''; for await (const chunk of req) body += chunk;
  const job = JSON.parse(body); pythonRuns++;
  const script = job.source + '\nprint("__TS_RESULT__" + json.dumps({"result":_out_json}, ensure_ascii=False))';
  const r = spawnSync(python, ['-c', script], { encoding: 'utf8', env: {...process.env, PYTHONIOENCODING:'utf-8'}, timeout: 10000, maxBuffer: 1024 * 1024 });
  const lines = (r.stdout || '').trim().split('\n'), marker = lines.find((l) => l.startsWith('__TS_RESULT__'));
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ ok: r.status === 0 && !!marker, error: r.stderr || r.error?.message, output: marker ? JSON.parse(marker.slice(13)).result : null, stdout: lines.filter((l) => !l.startsWith('__TS_RESULT__')).join('\n') }));
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const url = 'http://127.0.0.1:' + srv.address().port;
const browser = await chromium.launch();
let failures = 0;
const check = (ok, label) => { console.log((ok ? '  ✓ ' : '  ✗ ') + label); if (!ok) failures++; };
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(({ endpoint }) => {
    if (window.top !== window) return;
    window.loadPyodide = async () => {
      let chunks = [], input = 'null', out = null, stdout = () => {}, stderr = () => {};
      return {
        setStdout: (o) => { stdout = o.batched; }, setStderr: (o) => { stderr = o.batched; },
        globals: { set: (k, v) => { if (k === '_inp_json') input = v; }, get: (k) => k === '_out_json' ? out : null },
        runPython: (source) => {
          if (source.includes('_blocks = []')) { chunks = [source]; return; }
          chunks.push(source);
          if (!source.includes('_out_json = None')) return;
          const xhr = new XMLHttpRequest(); xhr.open('POST', endpoint + '/python', false);
          xhr.setRequestHeader('content-type', 'application/json');
          xhr.send(JSON.stringify({ source: '_inp_json = ' + JSON.stringify(input) + '\n' + chunks.join('\n') }));
          const r = JSON.parse(xhr.responseText);
          if (r.stdout) stdout(r.stdout);
          if (!r.ok) { stderr(r.error); throw new Error(r.error); }
          out = r.output;
        }
      };
    };
    if (localStorage.getItem('__btSeed')) return;
    localStorage.setItem('__btSeed', '1');
    const node = (id, name, lang, code, x, tests) => ({ id, name, lang, x, y: 180, codes: { [lang]: code }, tests, kind: 'block', desc: '' });
    const plain = 'def run(data):\n    return data.get("a", 2) + data.get("b", 3)';
    const decorated = 'from triosteum import block\n@block(sample={"demo":1})\ndef nullable(data):\n    return data is None';
    localStorage.setItem('triosteum.projects', JSON.stringify({ cur: 'p1', list: [{ id: 'p1', name: 'Тесты', env: 'code', t: Date.now() }, { id: 'p2', name: 'Другое', env: 'code', t: Date.now() }] }));
    const graph = { nodes: [node('a', 'Сложение', 'python', plain, 100, []), node('b', 'Пустой вход', 'python', decorated, 500, [{ name: 'Буквальный null', input: null, expected: true, mode: 'exact' }]), node('c', 'Число C++', 'cpp', 'int run(){ return 2; }', 900, [{ name: 'Допуск', input: {}, expected: 2.001, mode: 'number', tolerance: 0.01 }])], edges: [], notes: [], seq: 5, cam: { x: 0, y: 0, k: 1 } };
    localStorage.setItem('triosteum.proj.p1', JSON.stringify(graph));
    localStorage.setItem('triosteum.proj.p2', JSON.stringify({ ...graph, nodes: [node('a', 'Другой блок', 'python', plain, 100, [])] }));
    localStorage.setItem('triosteum.profile', '{"name":"Тест","org":"Тест"}');
    localStorage.setItem('triosteum.tour', '{"done":true}');
  }, { endpoint: url });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => { if (!/sandboxed/.test(e.message)) errors.push(e.message); });
  await page.goto(url); await page.locator('.node[data-id="a"]').waitFor();
  async function editor() {
    await page.locator('.node[data-id="a"]').click({ button: 'right' });
    await page.getByRole('button', { name: /^Тесты блока \(/ }).click();
    await page.getByRole('dialog', { name: 'Тесты блока «Сложение»' }).waitFor();
  }
  const results = page.locator('#runTests');
  const waitTests = async () => { await page.waitForFunction(() => /Тесты: успешно/.test(document.querySelector('#runTests').textContent)); };
  await editor();
  check(await page.getByRole('button', { name: 'Взять из последнего запуска' }).isDisabled(), 'до запуска чужие или отсутствующие результаты недоступны');
  for (const expected of ['5', '6']) {
    await page.getByRole('button', { name: 'Добавить тест', exact: true }).click();
    const i = expected === '5' ? 1 : 2;
    await page.getByRole('textbox', { name: 'Вход JSON теста ' + i, exact: true }).fill('{"a":2,"b":3}');
    await page.getByRole('textbox', { name: 'Ожидаемый JSON теста ' + i, exact: true }).fill(expected);
  }
  await page.getByRole('button', { name: 'Сохранить тесты', exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('triosteum.proj.p1')).nodes[0].tests);
  check(saved.length === 2 && saved[0].input.a === 2 && saved[1].expected === 6, 'оба кейса сохранены в узле графа');
  await page.getByRole('button', { name: 'Прогнать тесты блока', exact: true }).click(); await waitTests();
  check(await results.locator('.bt-result.bt-pass').count() === 1 && await results.locator('.bt-result.bt-fail').count() === 1, 'реальный Python: 2+3 → 5 проходит, → 6 падает');
  check(/Ожидалось: 6[\s\S]*Получено: 5/.test(await results.innerText()), 'показана разница ожидаемого и фактического результата');
  check(await page.locator('.node[data-id="a"] .bt-badge.bt-fail').count() === 1, 'на блоке красный индикатор ошибки');
  await page.locator('#runClose').click();
  await page.keyboard.press('Control+k'); await page.locator('#cmdQ').fill('Прогнать все тесты доски'); await page.keyboard.press('Enter'); await waitTests();
  check(await results.locator('.bt-result').count() === 4 && /успешно 3 · ошибок 1/.test(await results.innerText()), 'общая команда запускает все четыре кейса');
  check(await page.locator('.node[data-id="b"] .bt-pass').count() === 1, 'null не подменяется sample Python-декоратора');
  check(await page.locator('.node[data-id="c"] .bt-pass').count() === 1, 'общий исполнитель C++ и числовой допуск работают');
  await page.locator('#runClose').click();
  await page.locator('#topRun').click(); await page.waitForFunction(() => !document.querySelector('#runGo').disabled);
  await page.locator('#runClose').click(); await editor();
  await page.getByRole('button', { name: 'Взять из последнего запуска' }).click();
  const input = await page.getByRole('textbox', { name: 'Вход JSON теста 3', exact: true }).inputValue();
  check(JSON.parse(input).values.join() === '120,340,95', 'захвачен фактический вход обычного запуска, включая демо-данные');
  check(await page.getByRole('textbox', { name: 'Ожидаемый JSON теста 3', exact: true }).inputValue() === '5', 'захвачен результат последнего запуска');
  await page.getByRole('button', { name: 'Удалить тест 2', exact: true }).click();
  await page.getByRole('button', { name: 'Прогнать тесты блока', exact: true }).click(); await waitTests();
  check(/успешно 2 · ошибок 0/.test(await results.innerText()), 'кейс из последнего запуска воспроизводим');
  await page.locator('#runClose').click(); await editor();
  await page.getByRole('textbox', { name: 'Вход JSON теста 1', exact: true }).fill('{');
  const before = pythonRuns;
  await page.getByRole('button', { name: 'Прогнать тесты блока', exact: true }).click();
  check(/неверный JSON/.test(await page.locator('#btEditStatus').innerText()) && pythonRuns === before, 'неверный JSON не запускает код');
  await page.getByRole('textbox', { name: 'Вход JSON теста 1', exact: true }).fill('{"a":2,"b":3}');
  await page.getByRole('button', { name: 'Сохранить тесты', exact: true }).click();
  await page.addScriptTag({ path: fileURLToPath(new URL('../node_modules/axe-core/axe.min.js', import.meta.url)) });
  const audit = async () => page.evaluate(async () => (await window.axe.run(document.querySelector('.bt-dialog'), { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa'] } })).violations.filter((v) => ['serious','critical'].includes(v.impact)).map((v) => v.id));
  check((await audit()).length === 0, 'редактор тестов: нет серьёзных ошибок доступности в тёмной теме');
  await page.screenshot({ path: process.env.BT_SCREENSHOT || 'tests/.block-tests-preview.png' });
  await page.keyboard.press('Escape');
  check(!await page.getByRole('dialog', { name: 'Тесты блока «Сложение»' }).isVisible(), 'Escape закрывает редактор кейсов');
  await page.reload(); await page.locator('.node[data-id="a"]').waitFor(); await editor();
  check(await page.locator('.bt-case').count() === 2, 'кейсы сохраняются после перезагрузки');
  check(await page.locator('.bt-badge').count() === 0, 'после перезагрузки нет устаревших индикаторов');
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await page.getByRole('dialog', { name: 'Тесты блока «Сложение»' }).boundingBox();
  check(bounds.x >= 0 && bounds.x + bounds.width <= 391, 'окно тестов помещается на телефоне');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { const ui = JSON.parse(localStorage.getItem('triosteum.ui') || '{}'); ui.theme = 'light'; localStorage.setItem('triosteum.ui', JSON.stringify(ui)); });
  await page.reload(); await page.locator('.node[data-id=\"a\"]').waitFor(); await editor();
  await page.addScriptTag({ path: fileURLToPath(new URL('../node_modules/axe-core/axe.min.js', import.meta.url)) });
  check((await audit()).length === 0, 'редактор тестов: доступность в светлой теме на телефоне');
  check(errors.length === 0, 'нет ошибок JavaScript: ' + errors.join('; '));
  await ctx.close();
} finally { await browser.close(); await new Promise((ok) => srv.close(ok)); }
console.log(failures ? 'Ошибок: ' + failures : 'Всё прошло');
process.exitCode = failures ? 1 : 0;
