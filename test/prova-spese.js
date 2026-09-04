const { apriBrowser, APP, RADICE, leafletJs } = require('./browser');
const fs = require('fs');
const oggi = new Date().toISOString().split('T')[0];
const stato = {trips:[{id:1730000000001,name:'Esempio',destination:'Osaka',currency:'EUR',status:'open',start:oggi,end:oggi,participants:[{id:'p1',name:'Gepp'},{id:'p2',name:'Jak'}],suggested:[],pois:[],hotels:[],tickets:[],weather:{},createdAt:1,
  expenses:[{id:'e1',desc:'Cena',category:'Cibo',amount:40,origAmount:40,origCurrency:'EUR',rate:1,payerId:'p1',splitAmong:['p1','p2'],date:oggi},
            {id:'e2',desc:'Museo',category:'Attrazioni',amount:20,origAmount:20,origCurrency:'EUR',rate:1,payerId:'p2',splitAmong:['p1','p2'],date:oggi}],
  days:[{id:'d1',date:oggi,title:'',activities:[]}]}],currentTripId:1730000000001,settings:{proxRadius:200},myName:'Gepp'};
(async () => {
  const b = await apriBrowser();
  const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
  const err=[]; p.on('pageerror', e=>err.push(e.message.split('\n')[0]));
  await p.route('**/leaflet@1.9.4/dist/leaflet.js', r=>r.fulfill({status:200,contentType:'application/javascript',body:fs.readFileSync(leafletJs(),'utf8')}));
  await p.route('**/tile.openstreetmap.org/**', r=>r.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64')}));
  await p.addInitScript(s=>localStorage.setItem('geppgo2',JSON.stringify(s)), stato);
  await p.goto('file:///home/user/GeppGo/Index%202.1.html',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>typeof window.go==='function',{timeout:15000});
  await p.waitForTimeout(1500);

  const r=[]; const ok=(n,c,e='')=>r.push(`${c?'  OK  ':' FALLITO '} ${n}${e?' — '+e:''}`);

  const barra = await p.evaluate(()=>[...document.querySelectorAll('.nav-item')].map(x=>x.dataset.p));
  ok('il Budget non è più una voce della barra', !barra.includes('budget'), barra.join(' · '));
  const ic = await p.evaluate(()=>{
    const n=document.querySelector('.nav-item[data-p="money"]');
    return { svg: !!n.querySelector('svg'), testo: n.textContent.trim(), paths: n.querySelectorAll('path').length };
  });
  ok('le Spese hanno un\'icona disegnata, non il simbolo €', ic.svg && ic.testo==='', `testo:"${ic.testo}" paths:${ic.paths}`);
  ok('e il disegno è un sacchetto (più tratti)', ic.paths>=4, ic.paths+' tratti');

  await p.evaluate(()=>{go('money');scrollTo(0,0);});
  await p.waitForTimeout(700);

  // di partenza: Spese, esattamente come prima
  let v = await p.evaluate(()=>({
    spese: getComputedStyle(document.getElementById('moneySpese')).display,
    budget: getComputedStyle(document.getElementById('moneyBudget')).display,
    segSpeseAttivo: document.getElementById('segSpese').classList.contains('active'),
    testo: document.getElementById('money').innerText
  }));
  ok('entrando si vedono le Spese', v.spese!=='none' && v.budget==='none');
  ok('l\'interruttore parte su Spese', v.segSpeseAttivo);
  ok('e la pagina Spese è quella di prima', /Esempio/.test(v.testo) && /Saldi/.test(v.testo) && /Aggiungi spesa/.test(v.testo));
  ok('con le spese dentro', /Cena/.test(v.testo) && /Museo/.test(v.testo));

  // passo a Budget
  await p.evaluate(()=>moneyVista('budget'));
  await p.waitForTimeout(400);
  v = await p.evaluate(()=>({
    spese: getComputedStyle(document.getElementById('moneySpese')).display,
    budget: getComputedStyle(document.getElementById('moneyBudget')).display,
    segBudgetAttivo: document.getElementById('segBudget').classList.contains('active'),
    testo: document.getElementById('moneyBudget').innerText,
    tot: (document.getElementById('bAmt').textContent.match(/[€$]\s*[\d.,]+/)||[''])[0]
  }));
  ok('passando a Budget le Spese spariscono', v.spese==='none' && v.budget!=='none');
  ok('l\'interruttore segna Budget', v.segBudgetAttivo);
  ok('e il Budget è quello di prima: le categorie', /Per categoria/.test(v.testo) && /Cibo/.test(v.testo) && /Attrazioni/.test(v.testo), v.testo.replace(/\n+/g,' / ').slice(0,100));
  ok('con i conti giusti: 60 in due fa 30 a testa', /30/.test(v.tot), 'mostrato: '+v.tot);
  ok('e la tendina per persona', await p.evaluate(()=>!!document.getElementById('budgetWho')));

  // torno a Spese
  await p.evaluate(()=>moneyVista('spese'));
  await p.waitForTimeout(300);
  v = await p.evaluate(()=>({
    spese: getComputedStyle(document.getElementById('moneySpese')).display,
    budget: getComputedStyle(document.getElementById('moneyBudget')).display,
    testo: document.getElementById('moneySpese').innerText
  }));
  ok('tornando indietro si rivedono le Spese', v.spese!=='none' && v.budget==='none');
  ok('intatte', /Cena/.test(v.testo) && /Saldi/.test(v.testo));

  // il budget si aggiorna se cambiano le spese mentre è nascosto
  await p.evaluate(()=>{
    const t=T(); t.expenses.push({id:'e3',desc:'Treno',category:'Trasporti',amount:30,origAmount:30,origCurrency:'EUR',rate:1,payerId:'p1',splitAmong:['p1','p2'],date:new Date().toISOString().split('T')[0]});
    save(); renderAll();
  });
  await p.evaluate(()=>moneyVista('budget'));
  await p.waitForTimeout(400);
  const tot2 = await p.evaluate(()=>(document.getElementById('bAmt').textContent.match(/[€$]\s*[\d.,]+/)||[''])[0]);
  ok('rientrando nel Budget i numeri sono aggiornati (90 in due fa 45)', /45/.test(tot2), 'mostrato: '+tot2);

  await p.evaluate(()=>moneyVista('spese'));
  await p.waitForTimeout(300);
  await p.screenshot({ path: __dirname+'/spese.png' });
  await p.evaluate(()=>moneyVista('budget'));
  await p.waitForTimeout(400);
  await p.screenshot({ path: __dirname+'/budget.png' });

  console.log('\n'+r.join('\n'));
  const f=r.filter(x=>x.includes('FALLITO')).length;
  console.log(`\n${r.length-f}/${r.length} passati`);
  if(err.length) console.log('\nerrori: '+err.slice(0,4).join(' | '));
  await b.close();
  process.exit(f?1:0);
})();
