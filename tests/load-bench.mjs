// Скорость первой загрузки: сеть 10 Мбит/с, процессор медленнее в 4 раза. Запуск: node tests/load-bench.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs'; import { createServer } from 'node:http'; import { gzipSync } from 'node:zlib';
const html = readFileSync('docs/index.html'); const gz = gzipSync(html);
console.log('размер', (html.length/1024).toFixed(0)+' КБ', 'gzip', (gz.length/1024).toFixed(0)+' КБ');
const srv = createServer((q, r) => { if(q.url==='/'||q.url.startsWith('/?')){ r.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-encoding':'gzip' }); r.end(gz);} else { r.writeHead(404); r.end(); } });
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok)); const URL='http://127.0.0.1:'+srv.address().port+'/';
const b=await chromium.launch();
for (let i=0;i<3;i++){
const ctx=await b.newContext({viewport:{width:1440,height:900}});
await ctx.addInitScript(()=>{ localStorage.setItem('triosteum.profile',JSON.stringify({name:'Т',org:'З'})); localStorage.setItem('triosteum.tour','{"done":true}'); });
const p=await ctx.newPage(); const cdp=await ctx.newCDPSession(p);
await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:40,downloadThroughput:10*1024*1024/8,uploadThroughput:5*1024*1024/8});
await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
const t0=Date.now(); await p.goto(URL,{waitUntil:'load'}); 
await p.waitForFunction(()=>document.querySelector('.status') && document.querySelector('#envDock'));
const tReady=Date.now()-t0;
const m=await p.evaluate(()=>{ const n=performance.getEntriesByType('navigation')[0]; const fcp=performance.getEntriesByName('first-contentful-paint')[0]; return {dcl:Math.round(n.domContentLoadedEventEnd), load:Math.round(n.loadEventEnd), fcp:fcp?Math.round(fcp.startTime):null}; });
console.log('прогон', i+1, JSON.stringify(m), 'готово к работе', tReady, 'мс');
await ctx.close();
}
await b.close(); srv.close();
