// Проверка шаблона и очереди расширения на собранном интерфейсе с подменой API.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const env = 'ulabotk';
const tpl = {
  nodes: [{ id: 'n1', name: 'Блок из шаблона', lang: 'oee', x: 50, y: 50, codes: {} }],
  edges: [], notes: [], seq: 2,
};
const ext = {
  id: 'xscope', name: 'Проверка области', perms: ['board.read', 'board.write', 'background'],
  commands: [
    { id: 'wait', label: 'Ждать смены пространства', where: ['palette'] },
    { id: 'mark', label: 'Отметить блок', where: ['block'] },
  ],
  code: `
    triosteum.command('wait', () => new Promise(resolve => {
      triosteum.on('space', resolve);
      triosteum.ui.toast('Ожидаю смены пространства');
    }));
    triosteum.command('mark', ({ block }) => triosteum.board.update(block, { name: 'Изменённый блок' }));
  `,
};
const items = [
  { id: '1', kind: 'env', by: 'u1', data: { id: env, name: 'Лаборатория ОТК', color: '#0D9488', ic: 'lab', kinds: ['oee'], tpl } },
  { id: '2', kind: 'ext', by: 'u1', data: ext },
];
const boot = {
  user: { id: 'u1', name: 'Тест' }, org: { id: 'o1', name: 'Завод' }, role: 'owner', cur: 'p1',
  prefs: { ext: { [ext.id]: { on: true, perms: ext.perms } }, ui: { envDock: 'on' } },
  spaces: [{ id: 'p1', name: 'ОТК', env, rev: 1, content: tpl }], org_items: items,
};
const base = 'http://triosteum.test/';
const html = readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8')
  .replace('<!--@@BOOT@@-->', () => '<script>window.TRIOSTEUM_BOOT=' + JSON.stringify(boot) + '</script>');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(10000);
  await page.route(base + '**', route => {
    const url = route.request().url();
    if (url === base) return route.fulfill({ contentType: 'text/html', body: html });
    return route.fulfill({ json: url.includes('/org/items') ? { items } : {} });
  });
  const command = async name => {
    await page.keyboard.press('Control+k');
    await page.locator('#cmdQ').fill(name);
    await page.locator('#cmdList .cmdk-i', { hasText: name }).first().click();
  };
  const nodes = page.locator('#nodes .node');
  const checkTemplate = async () => {
    assert.equal(await nodes.count(), 1);
    assert.match(await nodes.first().textContent(), /Блок из шаблона/);
  };
  await page.goto(base);
  await nodes.first().waitFor();
  await command('Создать пространство');
  await checkTemplate();
  await page.locator('#projBtn').click();
  await page.getByRole('menuitem', { name: 'Создать пространство' }).click();
  await page.getByRole('menuitem', { name: 'В среде «Лаборатория ОТК»', exact: true }).first().click();
  await checkTemplate();
  await page.locator('#envDock').getByRole('button', { name: /Лаборатория ОТК/ }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Новое пространство', exact: true }).click();
  await checkTemplate();

  await command('Проверка области: Ждать смены пространства');
  await page.locator('#toast').filter({ hasText: 'Ожидаю смены пространства' }).waitFor();
  await nodes.first().click({ button: 'right' });
  await page.locator('.ext-block-cmd[data-cmd="mark"]').click();
  await page.keyboard.press('Escape');
  // Новый экземпляр шаблона содержит блок с тем же id, что и исходная доска.
  await command('Создать пространство');
  await page.locator('#toast').filter({ hasText: 'пространство сменилось до запуска команды' }).waitFor();
  await checkTemplate();
  console.log('Шаблоны и привязка команды к пространству: все проверки пройдены');
} finally {
  await browser.close();
}
