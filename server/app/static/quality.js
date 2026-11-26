const query = new URLSearchParams(location.search);
const endpoint = '/api' + location.pathname;
const content = document.getElementById('content');
const notice = document.getElementById('notice');
const states = {
  within_limit: 'В пределах допуска', pending: 'На рассмотрении', returned: 'Возвращено на доработку',
  approved: 'Принято', rejected: 'Отклонено', reassigned: 'Ответственный изменён', resubmitted: 'Отправлено повторно',
};
const fields = { article: 'Артикул', lot: 'Партия', inspected: 'Проверено изделий', defects: 'Дефектных изделий', note: 'Примечание' };
const date = value => new Date(value).toLocaleString('ru-RU');
const linkTo = id => '?case=' + encodeURIComponent(id);

function el(tag, attributes, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes || {})) {
    if (value != null) node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}

function label(text, control) {
  if (control.tagName === 'SELECT') control.setAttribute('aria-label', text);
  return el('label', null, text, control);
}

function button(text, action) {
  const control = el('button', { type: 'button' }, text);
  control.addEventListener('click', action);
  return control;
}

function heading(text, ...body) {
  content.replaceChildren(el('h2', { id: 'section-title' }, text), ...body);
}

async function api(path = '', method = 'GET', data) {
  const headers = {};
  let body = data;
  if (data !== undefined && !(data instanceof Blob)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(data);
  }
  const response = await fetch(path.startsWith('/api/') ? path : endpoint + path, { method, headers, body, cache: 'no-store' });
  const result = await response.json();
  if (!response.ok) {
    const message = Array.isArray(result.detail)
      ? 'Проверьте значения полей. Число дефектных изделий не должно превышать число проверенных.'
      : result.detail;
    throw new Error(message || 'Сервер отклонил запрос');
  }
  return result;
}

function showError(error) {
  notice.textContent = error.message || 'Не удалось выполнить запрос';
}

function submitForm(form, action) {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const controls = [...form.querySelectorAll('button[type="submit"]')];
    controls.forEach(control => { control.disabled = true; });
    notice.textContent = '';
    try {
      await action(event.submitter);
    } catch (error) {
      showError(error);
    } finally {
      controls.forEach(control => { control.disabled = false; });
    }
  });
}

function input(name, type, settings = {}) {
  return el('input', { name, type, ...settings });
}

async function readPhoto(file) {
  if (!file) return null;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Выберите фотографию JPEG, PNG или WebP');
  }
  if (file.size > 512 * 1024) {
    if (file.size > 20 * 1024 * 1024) throw new Error('Исходное фото должно быть не больше 20 МБ');
    const photo = await createImageBitmap(file);
    try {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1280 / Math.max(photo.width, photo.height));
      canvas.width = Math.max(1, Math.round(photo.width * scale));
      canvas.height = Math.max(1, Math.round(photo.height * scale));
      const drawing = canvas.getContext('2d', { alpha: false });
      drawing.fillStyle = '#fff';
      drawing.fillRect(0, 0, canvas.width, canvas.height);
      drawing.drawImage(photo, 0, 0, canvas.width, canvas.height);
      file = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.78));
      if (!file || file.size > 512 * 1024) throw new Error('Не удалось уменьшить фото до 512 КБ');
    } finally {
      photo.close();
    }
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Не удалось прочитать фотографию'));
    reader.readAsDataURL(file);
  });
}

function checkForm(record) {
  const form = el('form');
  const article = input('article', 'text', { required: '', maxlength: 100, value: record?.article, readonly: record ? '' : null });
  const lot = input('lot', 'text', { required: '', maxlength: 100, value: record?.lot, readonly: record ? '' : null });
  const inspected = input('inspected', 'number', { required: '', inputmode: 'numeric', min: 1, max: 10000000, value: record?.inspected });
  const defects = input('defects', 'number', { required: '', inputmode: 'numeric', min: 0, max: 10000000, value: record?.defects });
  const note = el('textarea', { rows: 3, maxlength: 1000 }, record?.note || '');
  const photo = input('photo', 'file', { accept: 'image/jpeg,image/png,image/webp' });
  form.append(el('div', { class: 'grid' }, label(fields.article, article), label(fields.lot, lot)),
    el('div', { class: 'grid' }, label(fields.inspected, inspected), label(fields.defects, defects)),
    label(fields.note, note), label('Фото, до 512 КБ', photo),
    el('div', { class: 'actions' }, el('button', { type: 'submit' }, record ? 'Отправить повторно' : 'Отправить проверку')));
  submitForm(form, async () => {
    if (Number(defects.value) > Number(inspected.value)) throw new Error('Число дефектных изделий больше числа проверенных');
    const data = { inspected: Number(inspected.value), defects: Number(defects.value), note: note.value, photo: await readPhoto(photo.files[0]) };
    if (record) {
      await api('/cases/' + record.id + '/resubmit', 'POST', { ...data, revision: record.revision });
      location.href = linkTo(record.id);
    } else {
      const result = await api('/cases', 'POST', { ...data, article: article.value, lot: lot.value });
      if (result.duplicate) throw new Error('Проверка для этого артикула и партии уже есть в реестре');
      location.href = linkTo(result.case.id);
    }
  });
  return form;
}

function dueLine(record) {
  if (record.status !== 'pending' || !record.due_at) return '';
  const overdue = Date.parse(record.due_at) < Date.now();
  return el('p', { class: overdue ? 'overdue' : null }, (overdue ? 'Просрочено. Срок был ' : 'Срок до '),
    el('time', { datetime: record.due_at }, date(record.due_at)));
}

function showRegister(dashboard, mine) {
  const params = new URLSearchParams({ view: mine ? 'tasks' : 'register' });
  if (dashboard.next) params.set('before', dashboard.next);
  const rows = dashboard.cases.map(record => el('article', null,
    el('h3', null, el('a', { href: linkTo(record.id) }, `№${record.id} · ${record.article} · ${record.lot}`)),
    el('p', null, `${states[record.status]} · Брак ${record.percent}%`), dueLine(record)));
  const pages = el('div', { class: 'actions' });
  if (query.has('before')) pages.append(el('a', { href: '?view=' + params.get('view') }, 'К новым записям'));
  if (dashboard.next) pages.append(el('a', { href: '?' + params }, 'Более ранние записи'));
  heading(mine ? 'Мои задачи' : 'Реестр',
    el('p', null, mine ? `Ожидают моего решения: ${dashboard.counts.mine}`
      : `На рассмотрении: ${dashboard.counts.pending} · Просрочено: ${dashboard.counts.overdue}`),
    !mine && dashboard.owner ? el('p', null,
      `Без действующего ответственного: ${dashboard.counts.unassigned}` +
      (dashboard.counts.avg_hours == null ? '' : ` · Среднее время до решения: ${dashboard.counts.avg_hours} ч`)) : '',
    ...(rows.length ? rows : [el('p', null, mine ? 'У вас нет открытых задач' : 'Проверок пока нет')]), pages);
}

async function showCase(id, dashboard) {
  const record = await api('/cases/' + encodeURIComponent(id));
  const summary = el('p', null, `Проверено: ${record.inspected} · Дефектных: ${record.defects} · Брак: ${record.percent}% · Допуск: ${record.threshold}%`);
  const actions = el('p', { class: 'actions' }, button('Распечатать акт', () => window.print()));
  const history = el('ol', null, ...record.history.map(event => el('li', null,
    `${states[event.action]} · ${event.actor} · ${date(event.at)}${event.comment ? ' · ' + event.comment : ''}`)));
  const created = el('p', null, 'Проверка от ', el('time', { datetime: record.created_at }, date(record.created_at)));
  const finished = ['approved', 'rejected'].includes(record.status)
    ? el('p', null, 'От проверки до решения: ' + new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 })
      .format((Date.parse(record.updated_at) - Date.parse(record.created_at)) / 3600000) + ' ч')
    : '';
  heading(`Проверка №${record.id} · ${record.article} · ${record.lot}`, created, el('p', null, states[record.status]),
    record.reviewer_name ? el('p', null, 'Ответственный: ' + record.reviewer_name)
      : record.status === 'pending' ? el('p', { class: 'overdue' }, 'Требуется назначить ответственного') : '',
    summary, dueLine(record), finished, record.note ? el('p', null, record.note) : '',
    record.has_photo ? el('p', null, el('img', { src: endpoint + '/cases/' + record.id + '/photo', alt: 'Фотография дефекта' })) : '',
    el('h3', null, 'История'), history, actions);
  if (record.can_decide) {
    const comment = el('textarea', { name: 'comment', maxlength: 1000, rows: 3, required: '' });
    const form = el('form', null, label('Комментарий к решению', comment),
      el('div', { class: 'actions' }, ...[['approved', 'Принять'], ['returned', 'Вернуть'], ['rejected', 'Отклонить']]
        .map(([value, text]) => el('button', { type: 'submit', value }, text))));
    submitForm(form, async submitter => {
      await api('/cases/' + record.id + '/decision', 'POST',
        { action: submitter.value, revision: record.revision, comment: comment.value });
      await showCase(id, dashboard);
      notice.textContent = 'Решение сохранено';
    });
    content.append(form);
  }
  if (record.status === 'returned' && record.is_author && dashboard.can_submit) {
    content.append(el('h3', null, 'Исправить проверку'), checkForm(record));
  }
}

async function showSettings(dashboard) {
  const settings = dashboard.settings;
  const { members } = await api('/api/org/members');
  const memberLabel = member => member.name || member.email;
  const reviewer = el('select', { required: '' }, el('option', { value: '' }, 'Выберите сотрудника'),
    ...members.map(member => el('option', { value: member.id }, memberLabel(member))));
  reviewer.value = settings?.reviewer_id || '';
  const threshold = input('threshold', 'number', { required: '', min: 0, max: 100, step: '0.01', value: settings?.threshold ?? '' });
  const hours = input('hours', 'number', { required: '', min: 1, max: 720, value: settings?.due_hours ?? 24 });
  const contributors = el('fieldset', null, el('legend', null, 'Кто может отправлять проверки'));
  for (const member of members.filter(member => member.role !== 'owner')) {
    const checkbox = input('contributors', 'checkbox', { value: member.id });
    checkbox.checked = settings?.contributors.includes(member.id) || false;
    contributors.append(el('label', { class: 'inline' }, checkbox, memberLabel(member)));
  }
  const form = el('form', null, label('Ответственный за превышения', reviewer),
    el('div', { class: 'grid' }, label('Допустимый брак, %', threshold), label('Срок решения, часов', hours)),
    contributors, el('div', { class: 'actions' }, el('button', { type: 'submit' }, 'Сохранить')));
  const links = el('p', { class: 'actions' }, el('a', { href: '?view=form' }, 'Ссылка на форму проверки'),
    el('a', { href: '?view=tasks' }, 'Ссылка на мои задачи'));
  links.hidden = !settings;
  submitForm(form, async () => {
    await api('/settings', 'PUT', { reviewer_id: reviewer.value, threshold: threshold.value,
      due_hours: Number(hours.value), contributors: [...contributors.querySelectorAll('input:checked')].map(node => node.value) });
    document.getElementById('form-link').hidden = false;
    document.getElementById('import-link').hidden = false;
    links.hidden = false;
    notice.textContent = 'Настройки сохранены';
  });
  heading('Настройки процесса', form, links);
}

function showImport(owner) {
  const file = input('file', 'file', { accept: '.csv,.xlsx', required: '' });
  const preview = el('div');
  const upload = el('form', null, label('Первый лист XLSX или CSV в UTF-8', file),
    el('div', { class: 'actions' }, el('button', { type: 'submit' }, 'Прочитать файл')));
  submitForm(upload, async () => {
    preview.replaceChildren();
    const workbook = file.files[0];
    const kind = workbook.name.split('.').pop().toLowerCase();
    const table = await api('/import/preview?kind=' + encodeURIComponent(kind), 'POST', workbook);
    const form = el('form');
    const controls = Object.entries(fields).map(([key, title]) => {
      const required = key !== 'note';
      const select = el('select', { required: required ? '' : null },
        el('option', { value: '' }, required ? 'Выберите колонку' : 'Пропустить'),
        ...table.headers.map(header => el('option', { value: header }, header)));
      select.value = table.headers.includes(table.mapping[key]) ? table.mapping[key] : '';
      form.append(label(title, select));
      return [key, select];
    });
    const save = input('save', 'checkbox');
    if (owner) form.append(el('label', { class: 'inline' }, save, 'Запомнить сопоставление для пространства'));
    form.append(el('div', { class: 'actions' }, el('button', { type: 'submit' }, 'Импортировать')));
    submitForm(form, async () => {
      const mapping = Object.fromEntries(controls.filter(([, select]) => select.value).map(([key, select]) => [key, select.value]));
      if (new Set(Object.values(mapping)).size !== Object.keys(mapping).length) throw new Error('Выберите отдельную колонку для каждого поля');
      const result = await api('/import', 'POST', { rows: table.rows, mapping, save_mapping: save.checked });
      const errors = result.rows.filter(row => row.status === 'error').length;
      const duplicates = result.rows.filter(row => row.status === 'duplicate').length;
      preview.replaceChildren(el('h3', null, 'Результат импорта'),
        el('p', null, `Добавлено: ${result.rows.length - errors - duplicates} · Дубли: ${duplicates} · Ошибки: ${errors}`),
        el('ul', null, ...result.rows.map(row => el('li', null, `Строка ${row.line} · `,
          row.id ? el('a', { href: linkTo(row.id) }, 'Проверка №' + row.id) : row.message))));
    });
    preview.replaceChildren(el('h3', null, 'Сопоставление колонок'), el('p', null, 'Строк в файле: ' + table.rows.length), form);
  });
  heading('Импорт проверок', upload, preview);
}

async function main() {
  const view = query.get('view') || 'register';
  const id = query.get('case');
  const filters = new URLSearchParams({ mine: view === 'tasks' });
  if (query.has('before')) filters.set('before', query.get('before'));
  const dashboard = await api('?' + filters);
  document.getElementById('space').textContent = dashboard.name;
  document.getElementById('sections').hidden = false;
  document.getElementById('form-link').hidden = !dashboard.can_submit;
  document.getElementById('import-link').hidden = !dashboard.can_submit;
  document.getElementById('settings-link').hidden = !dashboard.owner;
  const selected = [...document.querySelectorAll('nav a')].find(anchor => anchor.search === '?view=' + view);
  if (selected && !id) selected.setAttribute('aria-current', 'page');
  if (id) await showCase(id, dashboard);
  else if (view === 'settings' && dashboard.owner) await showSettings(dashboard);
  else if (view === 'import' && dashboard.can_submit) showImport(dashboard.owner);
  else if (view === 'form' && dashboard.can_submit) heading('Новая проверка', checkForm());
  else if (!dashboard.settings && dashboard.owner) {
    heading('Настройте контроль брака', el('a', { class: 'button', href: '?view=settings' }, 'Настройки процесса'));
  } else showRegister(dashboard, view === 'tasks');
}

main().catch(showError);
