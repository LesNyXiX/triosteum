// Сборка Triosteum: склеивает исходники из src/ в один файл docs/index.html.
// Запуск: node build.mjs        — собрать один раз
//         node build.mjs --watch — пересобирать при каждом сохранении
// Порядок файлов задаёт src/manifest.json: все части JS работают в одной общей области видимости.
import { readFileSync, writeFileSync, mkdirSync, watch } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'docs', 'index.html');   // папка docs/ — её умеет раздавать GitHub Pages

export function build() {
  const man = JSON.parse(readFileSync(join(SRC, 'manifest.json'), 'utf8'));
  const read = (p) => readFileSync(join(SRC, p), 'utf8');
  const css = man.css.map(read).join('\n');
  const js = man.js.map(read).join('\n');
  const tpl = read('index.template.html');
  if (!tpl.includes('<!--@@CSS@@-->') || !tpl.includes('<!--@@JS@@-->')) throw new Error('В шаблоне нет меток @@CSS@@ / @@JS@@');
  // функция-замена: иначе знаки $ в коде были бы поняты как шаблон замены
  const pre = read('app/core/idb-boot.js');
  // «</script» внутри кода закрыл бы тег скрипта раньше времени — страница не запустится
  const bad = /<\/script/i.exec(js + pre);
  if (bad) throw new Error('В коде есть «</script» (около: ' + JSON.stringify((js + pre).slice(Math.max(0, bad.index - 60), bad.index + 10)) + ') — напишите <\\/script>');
  const html = tpl.replace('<!--@@CSS@@-->', () => css).replace('<!--@@PRE@@-->', () => pre).replace('<!--@@JS@@-->', () => js);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, html);
  return { files: man.css.length + man.js.length + 1, bytes: Buffer.byteLength(html) };
}

const run = () => {
  try {
    const r = build();
    console.log(`[${new Date().toLocaleTimeString('ru-RU')}] собрано: ${r.files} файлов → docs/index.html (${Math.round(r.bytes / 1024)} КБ)`);
  } catch (e) { console.error('Ошибка сборки:', e.message); process.exitCode = 1; }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run();
  if (process.argv.includes('--watch')) {
    let t = null;
    watch(SRC, { recursive: true }, () => { clearTimeout(t); t = setTimeout(run, 80); });
    console.log('Слежу за src/ … (Ctrl+C — выход)');
  }
}
