// Сквозная проверка работы с сервером: вход, сохранение, конфликт, перенос из браузера, выход.
// Запуск: node tests/mock-server.mjs  (в другом окне)  →  node tests/server-e2e.mjs
// Настоящий сервер: TRIOSTEUM_URL=http://localhost:8000 node tests/server-e2e.mjs
import { chromium } from 'playwright';
const B = process.env.TRIOSTEUM_URL || 'http://localhost:8787';
(async () => { const b = await chromium.launch(); const errs = [];
 const ctx = await b.newContext({ viewport:{width:1280,height:800} });
 // в этом браузере уже есть одно локальное пространство — проверим перенос
 await ctx.addInitScript(()=>{ if(location.pathname!=='/login' || localStorage.getItem('triosteum.projects')) return;
   localStorage.setItem('triosteum.projects', JSON.stringify({cur:'loc1', list:[{id:'loc1',name:'Локальный цех',t:1,env:'code'}]}));
   localStorage.setItem('triosteum.proj.loc1', JSON.stringify({nodes:[{id:'n1',name:'Старый блок',lang:'python',x:100,y:100,codes:{}}],edges:[],notes:[],cam:{x:0,y:0,k:1},seq:5})); });
 const p = await ctx.newPage(); p.on('pageerror', e=>errs.push(e.message));
 await p.goto(B + '/'); console.log('redirect to', new URL(p.url()).pathname);
 await p.click('#tReg'); await p.fill('#org','Завод Тест'); await p.fill('#name','Иван'); await p.fill('#email','ivan@zavod.ru'); await p.fill('#pw','password123');
 await p.click('#go'); await p.waitForTimeout(400); console.log('no consent err:', await p.textContent('#err'));
 await p.check('#pd'); await p.click('#go'); await p.waitForURL(B + '/'); await p.waitForTimeout(900);
 await p.waitForTimeout(700); console.log('logged in, toast:', await p.textContent('#toast'));
 // добавить блок
 await p.click('#bAdd'); await p.click('[data-add="block"]'); await p.mouse.click(600, 400); await p.waitForTimeout(1600);
 console.log('nodes', await p.$$eval('.node', x=>x.length), 'saved:', await p.textContent('#saved').catch(()=>'?'));
 // перезагрузка: блок должен прийти с сервера
 await p.reload(); await p.waitForTimeout(800);
 console.log('after reload nodes', await p.$$eval('.node', x=>x.length));
 // правка коллеги на сервере → наша правка → конфликт
 const projs = await p.evaluate(()=>window.TRIOSTEUM_BOOT.spaces.map(s=>s.id)); const sid = projs[0];
 await p.evaluate(u=>fetch(u,{method:'POST'}), B + '/__test/' + encodeURIComponent('Завод Тест') + '/' + sid);
 const n = await p.$('.node'); const bb = await n.boundingBox();
 await p.mouse.move(bb.x+60,bb.y+40); await p.mouse.down(); await p.mouse.move(bb.x+160,bb.y+120,{steps:4}); await p.mouse.up(); await p.waitForTimeout(2000);
 console.log('conflict toast:', await p.textContent('#toast'));
 console.log('nodes now', await p.$$eval('.node', x=>x.map(e=>e.querySelector('.nt').textContent)));
 // перенос локальных пространств
 await p.click('#projBtn'); await p.waitForTimeout(300);
 const menu = await p.$$eval('.ctx button, .ctx [role=menuitem], .ctx .head, .ctx div', x=>x.map(e=>e.textContent.trim()).filter(Boolean)); console.log('menu tail', menu.slice(-4));
 await p.click('text=Перенести пространства из этого браузера…'); await p.waitForTimeout(2500);
 console.log('after import spaces', await p.evaluate(()=>window.TRIOSTEUM_BOOT.spaces.map(s=>s.name)));
 // выход
 await p.click('#projBtn'); await p.click('text=Выйти'); await p.waitForTimeout(1200); console.log('after logout', new URL(p.url()).pathname);
 // вход снова
 await p.fill('#email','ivan@zavod.ru'); await p.fill('#pw','wrongpass1'); await p.click('#go'); await p.waitForTimeout(500); console.log('bad pw:', await p.textContent('#err'));
 await p.fill('#pw','password123'); await p.click('#go'); await p.waitForURL(B + '/'); await p.waitForTimeout(700);
 console.log('relogin spaces', await p.evaluate(()=>window.TRIOSTEUM_BOOT.spaces.length));
 console.log('errs', errs); await b.close(); })();
