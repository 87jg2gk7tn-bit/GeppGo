const { apriBrowser, APP, RADICE, leafletJs } = require('./browser');
const fs = require('fs');
const oggi = new Date().toISOString().split('T')[0];
// viaggio in yen: 20000 spesi in due, quindi 10000 a testa
const stato = {trips:[{id:1730000000001,name:'Giappone 26',destination:'Tokyo',currency:'JPY',status:'open',start:oggi,end:oggi,
  participants:[{id:'p1',name:'Gepp',isMe:true},{id:'p2',name:'Jak'}],suggested:[],pois:[],hotels:[],tickets:[],weather:{},createdAt:1,
  expenses:[{id:'e1',desc:'Hotel',category:'Hotel',amount:20000,origAmount:20000,origCurrency:'JPY',rate:1,payerId:'p1',splitAmong:['p1','p2'],date:oggi}],
  days:[{id:'d1',date:oggi,title:'',activities:[]}]}],currentTripId:1730000000001,settings:{proxRadius:200},myName:'Gepp'};
(async () => {
  const b = await apriBrowser();
  const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
  const err=[]; p.on('pageerror', e=>err.push(e.message.split('\n')[0]));
  await p.route('**/leaflet@1.9.4/dist/leaflet.js', r=>r.fulfill({status:200,contentType:'application/javascript',body:fs.readFileSync(leafletJs(),'utf8')}));
  await p.route('**/tile.openstreetmap.org/**', r=>r.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64')}));
  // il cambio: 1 JPY = 0,0060 EUR (niente rete, si risponde noi)
  await p.route('**/v6/latest/**', r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({rates:{EUR:0.006,JPY:1,USD:0.0067}})}));
  await p.addInitScript(s=>localStorage.setItem('geppgo2',JSON.stringify(s)), stato);
  await p.goto('file:///home/user/GeppGo/Index%202.1.html',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>typeof window.openTripZoom==='function',{timeout:15000});
  await p.waitForTimeout(1200);

  const r=[]; const ok=(n,c,e='')=>r.push(`${c?'  OK  ':' FALLITO '} ${n}${e?' — '+e:''}`);
  const scheda = () => p.evaluate(()=>{
    const el=document.getElementById('tripZoomBody');
    const sel=el.querySelector('.cur-vis');
    return { testo: el.innerText, tendina: !!sel, scelta: sel?sel.value:null,
             opzioni: sel?[...sel.options].map(o=>o.textContent).slice(0,4):[] };
  });

  await p.evaluate(()=>openTripZoom(T().id));
  await p.waitForTimeout(600);
  let v = await scheda();
  ok('nella scheda del viaggio c\'è la tendina della valuta', v.tendina);
  ok('le prime voci partono dalla valuta del viaggio', v.opzioni[0]==='JPY', v.opzioni.join(', '));
  ok('di partenza la spesa è in yen', /¥\s?10\.?000/.test(v.testo.replace(/\s/g,' ')), (v.testo.match(/[¥€$]\s?[\d.,]+/g)||[]).join(' | '));

  // scelgo euro
  await p.evaluate(()=>setCurVista('EUR'));
  await p.waitForFunction(()=>/€/.test(document.getElementById('tripZoomBody').innerText),{timeout:8000});
  await p.waitForTimeout(300);
  v = await scheda();
  ok('scegliendo EUR la cifra si legge in euro', /€/.test(v.testo), (v.testo.match(/[¥€$]\s?[\d.,]+/g)||[]).join(' | '));
  ok('e il conto è giusto: 10.000 yen a 0,006 fanno 60 euro', /€\s?60/.test(v.testo.replace(/\s/g,' ')), (v.testo.match(/€\s?[\d.,]+/g)||[]).join(' | '));
  ok('la tendina resta su EUR', v.scelta==='EUR', String(v.scelta));

  // la scelta vale in tutta l'app
  const altrove = await p.evaluate(async ()=>{
    closeSheet('mTripZoom'); go('money'); await new Promise(r=>setTimeout(r,500));
    const spese=document.getElementById('money').innerText;
    moneyVista('budget'); await new Promise(r=>setTimeout(r,500));
    const budget=document.getElementById('moneyBudget').innerText;
    moneyVista('spese');
    return {spese,budget};
  });
  ok('la stessa scelta vale anche nelle Spese', /€/.test(altrove.spese), (altrove.spese.match(/[¥€]\s?[\d.,]+/g)||[]).slice(0,2).join(' | '));
  ok('e nel Budget', /€/.test(altrove.budget), (altrove.budget.match(/[¥€]\s?[\d.,]+/g)||[]).slice(0,2).join(' | '));

  // e tornando indietro alla valuta del viaggio
  await p.evaluate(()=>{setCurVista('');openTripZoom(T().id);});
  await p.waitForTimeout(600);
  v = await scheda();
  ok('tornando alla valuta del viaggio si rilegge in yen', /¥/.test(v.testo)&&!/€/.test(v.testo), (v.testo.match(/[¥€]\s?[\d.,]+/g)||[]).join(' | '));

  await p.evaluate(()=>{setCurVista('EUR');openTripZoom(T().id);});
  await p.waitForTimeout(700);
  await p.screenshot({ path: __dirname+'/valuta-scheda.png' });

  console.log('\n'+r.join('\n'));
  const f=r.filter(x=>x.includes('FALLITO')).length;
  console.log(`\n${r.length-f}/${r.length} passati`);
  if(err.length) console.log('\nerrori: '+err.slice(0,3).join(' | '));
  await b.close();
  process.exit(f?1:0);
})();
