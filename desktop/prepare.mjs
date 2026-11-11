// Готовит встроенную копию Triosteum для режима «без интернета»: собирает сайт и копирует его в desktop/web/.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
execFileSync(process.execPath, [join(ROOT, 'build.mjs')], { cwd: ROOT, stdio: 'inherit' });
const out = join(HERE, 'web');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(ROOT, 'docs', 'index.html'), join(out, 'index.html'));
if (existsSync(join(ROOT, 'docs', 'vendor'))) cpSync(join(ROOT, 'docs', 'vendor'), join(out, 'vendor'), { recursive: true });
console.log('Встроенная копия Triosteum готова: desktop/web/');
