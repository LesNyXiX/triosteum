import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
const url = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '../docs/index.html')).href;
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    if (window.top !== window) return;
    localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Тест', org: 'Демо' }));
    localStorage.setItem('triosteum.tour', '{"done":true}');
  });
  await page.goto(url);
  await page.mouse.move(800, 300);
  await page.waitForSelector('.ed-morph-icons .ed-morph-icon');
  const count = await page.locator('#envDock .ed-i').count();
  for (const t of [0, 80, 230, 380, 459]) {
    const state = await page.evaluate(t => {
      document.getAnimations().filter(a => a.effect.target.closest?.('.ed-morph-icons') || a.effect.target.matches?.('.ed-morph')).forEach(a => { a.pause(); a.currentTime = t; });
      return [...document.querySelectorAll('.ed-morph-icon')].map(el => {
        const r = el.getBoundingClientRect(); return { w:r.width, h:r.height, opacity:getComputedStyle(el).opacity, svg:!!el.querySelector('svg') };
      });
    }, t);
    assert.equal(state.length, count);
    assert.ok(state.every(s => s.w > 0 && s.h > 0 && s.opacity === '1' && s.svg), `visible icons at ${t}ms`);
    if (t === 230 && process.env.DOCK_SCREENSHOT) await page.screenshot({ path:process.env.DOCK_SCREENSHOT });
  }
  // Keyboard focus during collapse must reverse the transition without orphan overlays.
  await page.locator('#envDock .ed-i').first().focus();
  await page.waitForFunction(() => !document.querySelector('.ed-morph'));
  assert.equal(await page.locator('.ed-morph-icons').count(), 0);
  assert.equal(await page.locator('#envDock').evaluate(e => e.classList.contains('folded')), false);
  await page.locator('#topRun').focus();
  await page.waitForSelector('.ed-mini.on');
  const mini = await page.locator('.ed-mini').boundingBox();
  await page.mouse.move(mini.x + 20, mini.y + mini.height / 2);
  await page.waitForSelector('.ed-morph-icons .ed-morph-icon');
  assert.equal(await page.locator('.ed-morph-icon svg').count(), count);
  await page.waitForFunction(() => !document.querySelector('.ed-morph'));
  assert.equal(await page.locator('#envDock').evaluate(e => getComputedStyle(e).opacity), '1');
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.mouse.move(800, 300);
  await page.waitForSelector('.ed-mini.on');
  assert.equal(await page.locator('.ed-morph-icons').count(), 0);
  assert.deepEqual(errors, []);
  console.log('dock-morph: icons visible throughout collapse, reverse, expansion, reduced motion — passed');
} finally { await browser.close(); }
