const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const fixture = (id, sequence, date, time, disposition) => ({id, sequence, year:2026,
  incidentNumber:`26PL${String(sequence).padStart(5,'0')}`, dispatchDate:date, dispatchTime:time,
  callNature:'MEDICAL', address:'123 MAIN ST', responseType:'EMS', emsDisposition:disposition});
const calls = [fixture('legacy',1,'2026-09-26','10:00','TRANSPORT'),
  fixture('vol',2,'2026-09-27','20:00','NO CREW/MA; OTHER EMS XPORT; 2ND RUN; 76 COVERAGE'),
  fixture('day',3,'2026-09-28','10:00','NO CREW/MA; 2ND RUN')];
const firebase = {
  'firebase-app.js': 'export const initializeApp = () => ({});',
  'firebase-auth.js': `export const getAuth = () => ({});
    export const signInAnonymously = async () => ({});
    export const signInWithCustomToken = async () => ({});
    export const onAuthStateChanged = (auth, callback) => queueMicrotask(() => callback({uid:'test-user'}));`,
  'firebase-firestore.js': `export const getFirestore = () => ({});
    export const collection = (...args) => ({kind:'collection'});
    export const doc = (...args) => ({id: typeof args.at(-1) === 'string' ? args.at(-1) : 'new-'+(++window._id)});
    export const getDoc = async () => ({exists: () => false});
    export const onSnapshot = (ref, callback) => {
      window._listeners.push(callback); queueMicrotask(window._emit);
    };
    export const addDoc = async (ref, data) => {
      window._writes.push(data); window._calls.push({id:'new-'+(++window._id),...data}); window._emit();
    };
    export const updateDoc = async (ref, data) => {
      window._writes.push(data); Object.assign(window._calls.find(c => c.id === ref.id),data); window._emit();
    };
    export const deleteDoc = async () => {};
    export const writeBatch = () => {
      const ops=[]; return {set:(ref,data)=>ops.push({ref,data,create:true}),update:(ref,data)=>ops.push({ref,data}),
        commit:async()=>{for(const op of ops){window._writes.push(op.data);
          if(op.create) window._calls.push({id:op.ref.id,...op.data});
          else Object.assign(window._calls.find(c=>c.id===op.ref.id),op.data);
        } window._emit();}};
    };`
};
let browser;
const server = http.createServer((req,res) => {
  const file = path.join(root, new URL(req.url,'http://localhost').pathname === '/' ? 'index.html' : new URL(req.url,'http://localhost').pathname.slice(1));
  if (!file.startsWith(root+path.sep) || !fs.existsSync(file)) {res.writeHead(404).end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || 'msedge'});
  const context = await browser.newContext();
  await context.addInitScript(seed => {
    window._calls=seed; window._writes=[]; window._listeners=[]; window._id=0;
    window._emit=()=>window._listeners.forEach(cb=>cb({forEach:fn=>window._calls.forEach(c=>fn({id:c.id,data:()=>c}))}));
  }, calls);
  await context.route('**/*', async route => {
    const reqUrl = new URL(route.request().url());
    if (reqUrl.hostname === '127.0.0.1') return route.continue();
    const stub = firebase[reqUrl.pathname.split('/').at(-1)];
    return route.fulfill({status:200,contentType:stub?'text/javascript':'text/css',body:stub||''});
  });
  const page = await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.accept());
  await page.clock.install({time:new Date('2026-09-30T16:00:00Z')});
  await page.goto(url);
  await page.addStyleTag({content:'.hidden {display:none !important}'});
  await page.waitForFunction(()=>document.querySelector('#emsDisposition input') && !document.getElementById('submitBtn').disabled);
  assert.equal(await page.locator('#emsDisposition input').count(),8);
  assert.equal(await page.locator('#stat-crew-combined').textContent(),'3');
  assert.equal(await page.locator('#stat-crew-day').textContent(),'2');
  assert.equal(await page.locator('#stat-crew-vol').textContent(),'1');
  assert.equal(await page.locator('#stat-crew-combined-pct').textContent(),'33% RESP');
  assert.equal(await page.locator('#stat-crew-76-coverage').textContent(),'1');
  assert.match(await page.locator('#stats-vol-dispo').textContent(), /2ND RUN/);
  assert.doesNotMatch(await page.locator('#stats-vol-dispo').textContent(), /NO CREW\/MA;/);
  console.log('Statistics: categories counted individually, calls counted once, Saturday is day crew');

  await page.fill('#callNature','MEDICAL'); await page.fill('#address','123 MAIN ST');
  await page.fill('#dispatchDate','2026-09-27'); await page.fill('#dispatchTime','20:00');
  await page.click('#submitBtn');
  assert.equal(await page.evaluate(()=>window._writes.length),0);
  assert.equal(await page.locator('#toastMessage').textContent(),'SELECT AT LEAST ONE EMS DISPOSITION');
  await page.check('#emsDisposition input[value="TRANSPORT"]');
  await page.check('#emsDisposition input[value="2ND RUN"]');
  await page.click('#submitBtn');
  await page.waitForFunction(()=>window._writes.length===1);
  assert.equal(await page.evaluate(()=>window._writes[0].emsDisposition),'TRANSPORT; 2ND RUN');
  assert.equal(await page.locator('#emsDisposition input:checked').count(),0);
  assert.match(await page.locator('#historyTableBody').textContent(),/TRANSPORT; 2ND RUN/);
  assert.equal(await page.locator('#stat-crew-combined').textContent(),'4');
  console.log('New call: empty selection blocked, multiple selections saved and form reset');

  await page.evaluate(()=>openEditModal('legacy'));
  assert.equal(await page.locator('#edit_emsDisposition input:checked').count(),1);
  await page.check('#edit_emsDisposition input[value="REFUSAL"]');
  await page.evaluate(()=>saveEdit());
  assert.equal(await page.evaluate(()=>window._calls.find(c=>c.id==='legacy').emsDisposition),'TRANSPORT; REFUSAL');
  await page.evaluate(()=>openEditModal('legacy'));
  assert.equal(await page.locator('#edit_emsDisposition input:checked').count(),2);
  await page.locator('#edit_emsDisposition input:checked').evaluateAll(inputs=>inputs.forEach(input=>input.checked=false));
  await page.evaluate(()=>saveEdit());
  assert.equal(await page.evaluate(()=>window._writes.length),2);
  await page.evaluate(()=>closeEditModal());
  console.log('Editing: older single selection restored, multiple selections restored, empty selection blocked');

  await page.evaluate(()=>{document.getElementById('filterDisposition').value='2ND RUN';renderTable();});
  assert.equal(await page.locator('#recordCount').textContent(),'3 Records');
  await page.evaluate(()=>{document.getElementById('filterDisposition').value='REFUSAL';renderTable();});
  assert.equal(await page.locator('#recordCount').textContent(),'1 Records');
  await page.evaluate(()=>resetFilters());
  await page.evaluate(()=>handleSort('disposition'));
  console.log('History: filters match individual selections and disposition sorting runs');

  const downloadEvent = page.waitForEvent('download');
  await page.evaluate(()=>exportToCSV());
  const download = await downloadEvent;
  const csv = fs.readFileSync(await download.path(),'utf8');
  assert.match(csv,/TRANSPORT; REFUSAL/);
  assert.match(csv,/TRANSPORT; 2ND RUN/);
  await page.setInputFiles('#csvInput',{name:'round-trip.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await page.waitForFunction(()=>document.getElementById('importStatus').textContent==='DONE!');
  assert.equal(await page.evaluate(()=>window._calls.find(c=>c.id==='legacy').emsDisposition),'TRANSPORT; REFUSAL');
  assert.equal(await page.evaluate(()=>window._calls.find(c=>c.sequence===4).emsDisposition),'TRANSPORT; 2ND RUN');
  console.log('CSV: exported and reimported selections preserved');

  await page.evaluate(()=>{window._calls.find(c=>c.id==='legacy').emsDisposition='IMPORTED OUTCOME; TRANSPORT';window._emit();openEditModal('legacy');});
  assert.equal(await page.locator('#edit_emsDisposition input[value="IMPORTED OUTCOME"]:checked').count(),1);
  await page.evaluate(()=>saveEdit());
  assert.equal(await page.evaluate(()=>window._calls.find(c=>c.id==='legacy').emsDisposition),'TRANSPORT; IMPORTED OUTCOME');
  await page.evaluate(()=>{openEditModal('legacy');selectEditType('Fire');return saveEdit();});
  assert.equal(await page.evaluate(()=>window._calls.find(c=>c.id==='legacy').emsDisposition),null);
  console.log('Compatibility: custom imported disposition preserved; Fire save clears EMS dispositions');

  const kiosk=await context.newPage();
  kiosk.on('pageerror',error=>errors.push(error.message));
  await kiosk.clock.install({time:new Date('2026-09-30T16:00:00Z')});
  await kiosk.goto(url+'/kiosk.html');
  await kiosk.waitForFunction(()=>document.getElementById('stat-crew-combined').textContent==='3');
  assert.equal(await kiosk.locator('#stat-crew-combined-pct').textContent(),'33% COVERED');
  assert.equal(await kiosk.locator('#stat-crew-76-coverage').textContent(),'1');
  assert.match(await kiosk.locator('#stats-vol-dispo').textContent(),/2ND RUN/);
  assert.doesNotMatch(await kiosk.locator('#stats-vol-dispo').textContent(),/NO CREW\/MA;/);
  assert.deepEqual(errors,[]);
  console.log('Kiosk: individual categories and coverage totals verified; no browser errors');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  if(browser) await browser.close(); server.close();
});
