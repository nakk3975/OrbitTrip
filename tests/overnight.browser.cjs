const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
 const {generate,warnings}=await import(pathToFileURL(path.resolve(__dirname,'../public/engine.js')));
 const server=spawn(process.execPath,['server.mjs'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,PORT:'3035'},stdio:['ignore','pipe','pipe']});let browser;
 try{
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('server exited '+code)));});
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-gpu'],headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1050},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/geo/status',r=>r.fulfill({json:{enabled:false}}));
  await page.goto('http://localhost:3035');
  const airport={name:'하네다',city:'도쿄',lat:35.5494,lng:139.7798};
  const config={country:'JP',start:'2026-12-31',end:'2027-01-04',cities:Array(5).fill('도쿄'),windows:{},visits:[],fixed:[],externalPlaces:[],travelMode:'transit',pace:'normal',stays:[{id:'h',name:'숙소',city:'도쿄',lat:35.713,lng:139.775,from:'2026-12-31',to:'2027-01-04',checkin:'15:00',checkout:'11:00',checkinDuration:30,checkoutDuration:20}],flights:{arrival:{...airport,time:'17:00',buffer:60},departure:{...airport,time:'17:00',buffer:180}},plan:[],active:0,dirty:false,plannerVersion:3};
  // An actual old v2 shape: no date-time additions in the existing saved plan.
  config.plan=generate(config).map(d=>({...d,items:d.items.map(({startDateTime,endDateTime,...p})=>p)}));
  async function load(s){await page.evaluate(s=>{localStorage.clear();localStorage.setItem('orbittrip-v2',JSON.stringify({version:2,state:s}));},s);await page.reload();await page.waitForFunction(()=>!!document.querySelector('#resume').onclick);await page.locator('#resume').click();}
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('orbittrip-v2')).state);
  async function generateUI(){await page.locator('#generate').click();await page.locator('#itinerary').waitFor({state:'visible'});const s=await state();assert.deepEqual(s.plan.flatMap(warnings),[]);return s;}
  async function flight(kind,time,buffer){await page.locator(`[data-flight="${kind}"]`).click();await page.locator('#flight-time').fill(time);await page.locator('#flight-buffer').fill(String(buffer));await page.locator('#logistics-form [type=submit]').click();}
  await load(config);assert.equal(await page.locator('.timeline-time').first().innerText(),'17:00\n18:00');assert.ok(await page.locator('#dirty-notice').isVisible());
  await page.locator('#back-plan').click();await flight('arrival','23:30',60);await flight('departure','01:00',180);
  let s=await generateUI();assert.equal(s.plan[0].items[0].endDateTime,'2027-01-01T00:00');
  await page.locator('[data-day="1"]').click();assert.match(await page.locator('#timeline').innerText(),/입국·수하물/);assert.match(await page.locator('#timeline').innerText(),/2026-12-31 23:30 → 2027-01-01 00:30/);assert.equal(s.plan[1].items[2].kind,'checkin');
  await page.locator('[data-day="3"]').click();assert.match(await page.locator('#timeline').innerText(),/체크아웃/);await page.locator('[data-day="4"]').click();assert.match(await page.locator('#timeline').innerText(),/00:00/);assert.match(await page.locator('#timeline').innerText(),/01:00/);
  const expected=s.plan;await page.reload();await page.locator('#resume').click();assert.deepEqual((await state()).plan,expected);
  const downloadEvent=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadEvent;const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(exported.version,2);assert.deepEqual(exported.plan,expected);
  // Regeneration preserves the flight input, then exercise a checkout spanning midnight.
  await page.locator('#back-plan').click();await generateUI();assert.deepEqual((await state()).plan,expected);
  await page.locator('#back-plan').click();await page.locator('[data-stay-edit]').click();await page.locator('.stay-advanced summary').click();await page.locator('#stay-out-duration').fill('30');await page.locator('#logistics-form [type=submit]').click();await flight('departure','02:20',60);s=await generateUI();assert.equal(s.plan[3].items.at(-1).kind,'checkout');assert.equal(s.plan[4].items[0].end,'00:20');
  // Airport arrival exactly at midnight must carry the airport position forward.
  await page.locator('#back-plan').click();await flight('departure','03:00',180);s=await generateUI();assert.equal(s.plan[4].origin.lat,airport.lat);assert.equal(s.plan[4].items[0].start,'00:00');
  // Transfer and check-in cross midnight independently.
  await page.locator('#back-plan').click();await flight('arrival','22:45',30);s=await generateUI();assert.equal(s.plan[0].items.at(-1).kind,'transfer');assert.equal(s.plan[1].items[0].kind,'transfer');
  await page.locator('#back-plan').click();await page.locator('[data-stay-edit]').click();await page.locator('.stay-advanced summary').click();await page.locator('#stay-checkin').fill('23:45');await page.locator('#logistics-form [type=submit]').click();await flight('arrival','22:00',15);s=await generateUI();assert.equal(s.plan[1].items[0].kind,'checkin');assert.equal(s.plan[1].items[0].end,'00:15');
  // Real 390px Chromium layout and restoration of overnight chunks.
  await page.setViewportSize({width:390,height:844});await page.locator('[data-day="1"]').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const dir=process.env.SHOT_DIR||'/tmp/orbittrip-frames';fs.mkdirSync(dir,{recursive:true});await page.screenshot({path:dir+'/overnight-mobile.png',fullPage:true});await page.reload();await page.locator('#resume').click();assert.deepEqual((await state()).plan,s.plan);
  // A 90-day v2 draft goes through actual form generation and date navigation.
  const long={...config,start:'2026-12-31',end:'2027-03-30',cities:Array(90).fill('도쿄'),stays:[{...config.stays[0],to:'2027-03-30'}],flights:{arrival:{...airport,time:'23:30',buffer:60},departure:{...airport,time:'01:00',buffer:180}},plan:[]};
  await load(long);s=await generateUI();assert.equal(s.plan.length,90);await page.locator('#result-date').selectOption('89');assert.match(await page.locator('#day-title').innerText(),/2027.03.30/);await page.reload();await page.locator('#resume').click();assert.equal((await state()).plan.length,90);
  // A conflicting fixed booking blocks generation and preserves the previous plan.
  const conflict={...long,visits:[{id:'v',name:'예약',city:'도쿄',lat:35.713,lng:139.775,date:'2027-01-01',start:'00:45',end:'01:00'}],plan:s.plan};await load(conflict);await page.locator('#back-plan').click();await page.locator('#generate').click();assert.match(await page.locator('#form-error').innerText(),/겹칩니다|부족/);assert.deepEqual((await state()).plan,s.plan);
  assert.deepEqual(errors,[]);console.log('PASS Chromium: old v2, arrival/baggage/transfer/check-in and checkout/transfer/departure midnight rollover, form edits, date tabs, regeneration, reload, JSON export, mobile, 90 days, conflict preservation; zero JS errors.');
 }finally{await browser?.close();server.kill();}
})().catch(e=>{console.error(e);process.exit(1)});
