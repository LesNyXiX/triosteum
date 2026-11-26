// Сквозной контроль брака с настоящим сервером и открытой регистрацией.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const baseURL = process.env.TRIOSTEUM_URL || 'http://127.0.0.1:8000';
const password = 'quality-test-password';
const space = 'quality-test';
const path = '/quality/' + space;
const browser = await chromium.launch();
try {
  const desktop = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
  const mobile = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const approval = await browser.newContext({ baseURL });
  const owner = await desktop.newPage();
  const controller = await mobile.newPage();
  const reviewer = await approval.newPage();
  const errs = [];
  for (const page of [owner, controller, reviewer]) {
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errs.push(error.message));
  }
  async function checked(response) {
    assert.ok(response.ok(), response.status() + ' ' + await response.text());
    return response.json();
  }
  await checked(await desktop.request.post('/api/auth/register', { data: {
    name: 'Владелец ОТК', org: 'Тестовая фабрика', email: `owner-${randomUUID()}@example.test`, password, pd_consent: true,
  } }));
  async function invite(context, name, role) {
    const email = `user-${randomUUID()}@example.test`;
    const data = await checked(await desktop.request.post('/api/org/invites', { data: { email, role } }));
    const token = new URL(data.path, baseURL).searchParams.get('t');
    await checked(await context.request.post('/api/auth/accept-invite', { data: { name, token, password, pd_consent: true } }));
    return email;
  }
  const email = await invite(mobile, 'Контролёр', 'viewer');
  await invite(approval, 'Начальник ОТК', 'approver');
  await checked(await desktop.request.put('/api/spaces/' + space, { data: { name: 'Участок ОТК', content: {}, rev: 0 } }));
  await owner.goto('/');
  await owner.locator('#cmdBtn').click();
  await owner.locator('#cmdQ').fill('Контроль брака');
  await owner.locator('#cmdList .cmdk-i', { hasText: 'Контроль брака' }).click();
  await owner.getByRole('link', { name: 'Настройки процесса' }).click();
  await owner.getByLabel('Ответственный за превышения').selectOption({ label: 'Начальник ОТК' });
  await owner.getByLabel('Допустимый брак, %').fill('2');
  await owner.getByRole('checkbox', { name: 'Контролёр' }).check();
  await owner.getByRole('button', { name: 'Сохранить' }).click();
  await owner.getByRole('link', { name: 'Ссылка на форму проверки' }).waitFor();

  await mobile.request.post('/api/auth/logout');
  await controller.goto(path + '?view=form');
  await controller.locator('#email').fill(email);
  await controller.locator('#pw').fill(password);
  await controller.locator('#go').click();
  await controller.getByRole('heading', { name: 'Новая проверка' }).waitFor();
  assert.equal(await controller.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await controller.getByLabel('Артикул').fill('Куртка 17');
  await controller.getByLabel('Партия').fill('П-8');
  await controller.getByLabel('Проверено изделий').fill('100');
  await controller.getByLabel('Дефектных изделий').fill('4');
  await controller.getByRole('button', { name: 'Отправить проверку' }).click();
  await controller.getByRole('heading', { name: /Проверка №.*Куртка 17/ }).waitFor();
  const caseURL = new URL(controller.url()).pathname + new URL(controller.url()).search;
  await controller.close();

  await reviewer.goto(path + '?view=tasks');
  await reviewer.getByRole('link', { name: /Куртка 17/ }).click();
  await reviewer.getByLabel('Комментарий к решению').fill('Подтвердили дефекты');
  await reviewer.getByRole('button', { name: 'Принять', exact: true }).click();
  await reviewer.getByText('Решение сохранено').waitFor();
  await owner.goto(caseURL);
  await owner.getByText(/Принято · Начальник ОТК/).waitFor();
  await owner.getByRole('button', { name: 'Распечатать акт' }).waitFor();

  await owner.getByRole('link', { name: 'Импорт XLSX / CSV' }).click();
  const csv = Buffer.from('Изделие;Лот;Проверено;Брак\nПальто;42;20;1');
  const upload = async () => {
    await owner.locator('input[type=file]').setInputFiles({ name: 'checks.csv', mimeType: 'text/csv', buffer: csv });
    await owner.getByRole('button', { name: 'Прочитать файл' }).click();
    await owner.getByRole('heading', { name: 'Сопоставление колонок' }).waitFor();
  };
  await upload();
  for (const [label, column] of [['Артикул', 'Изделие'], ['Партия', 'Лот'], ['Проверено изделий', 'Проверено'], ['Дефектных изделий', 'Брак']]) {
    await owner.getByLabel(label, { exact: true }).selectOption(column);
  }
  await owner.getByLabel('Запомнить сопоставление для пространства').check();
  await owner.getByRole('button', { name: 'Импортировать' }).click();
  await owner.getByText('Добавлено: 1 · Дубли: 0 · Ошибки: 0').waitFor();
  await upload();
  assert.equal(await owner.getByLabel('Артикул', { exact: true }).inputValue(), 'Изделие');
  await owner.getByRole('button', { name: 'Импортировать' }).click();
  await owner.getByText('Добавлено: 0 · Дубли: 1 · Ошибки: 0').waitFor();
  assert.deepEqual(errs, []);
  console.log('Контроль брака: мобильная форма, назначение, решение и повторный импорт прошли');
} finally {
  await browser.close();
}
