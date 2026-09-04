const { apriBrowser, APP, RADICE, leafletJs } = require('./browser');
const fs = require('fs');
(async () => {
  const b = await apriBrowser();
  const r=[]; const ok=(n,c,e='')=>r.push(`${c?'  OK  ':' FALLITO '} ${n}${e?' — '+e:''}`);

  async function apri(){
    const p = await b.newPage({ viewport:{width:390,height:844} });
    p.on('pageerror', e=>r.push(' FALLITO  errore in pagina: '+e.message.split('\n')[0]));
    await p.route('**/leaflet@1.9.4/dist/leaflet.js', ro=>ro.fulfill({status:200,contentType:'application/javascript',body:fs.readFileSync(leafletJs(),'utf8')}));
    await p.route('**/tile.openstreetmap.org/**', ro=>ro.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64')}));
    await p.route('**/api/interpreter', ro=>ro.fulfill({status:200,contentType:'application/json',body:'{"elements":[]}'}));
    await p.addInitScript(()=>localStorage.setItem('geppgo2', JSON.stringify({trips:[],currentTripId:null,settings:{proxRadius:200},myName:'Gepp',skipAuth:true})));
    await p.goto('file:///home/user/GeppGo/Index%202.1.html',{waitUntil:'domcontentloaded'});
    await p.waitForFunction(()=>typeof window.openNewTrip==='function',{timeout:15000});
    await p.waitForTimeout(1000);
    return p;
  }
  // compila il modulo; se confermaCompagno è false, il nome resta scritto nella casella
  const creaViaggio = async (p, compagno, confermaCompagno) => p.evaluate(async ({compagno, conferma}) => {
    openNewTrip();
    document.getElementById('ntMe').value = 'Gepp';
    document.getElementById('ntName').value = 'Viaggio di prova';
    document.getElementById('ntDest').value = 'Osaka';
    document.getElementById('ntPersonInput').value = compagno;
    if (conferma) addNtPerson();
    createTrip();
    await new Promise(r=>setTimeout(r,400));
    const t = T();
    return { partecipanti: (t.participants||[]).map(x=>x.name), rimastoScritto: document.getElementById('ntPersonInput').value };
  }, {compagno, conferma:confermaCompagno});

  // ── 1. premendo "+" (come si dovrebbe) ───────────────────────────────
  let p = await apri();
  let res = await creaViaggio(p, 'Jak', true);
  ok('col "+" il compagno c\'è', res.partecipanti.includes('Jak'), res.partecipanti.join(', '));
  ok('e ci sono tutti e due', res.partecipanti.length===2, res.partecipanti.join(', '));
  await p.close();

  // ── 2. scrivendolo e basta: è il caso che si perdeva ─────────────────
  p = await apri();
  res = await creaViaggio(p, 'Jak', false);
  ok('scritto e non confermato, il compagno c\'è LO STESSO', res.partecipanti.includes('Jak'), res.partecipanti.join(', '));
  ok('e non resta niente nella casella', res.rimastoScritto==='', `"${res.rimastoScritto}"`);

  // ── 3. e si ritrova in tutte le altre sezioni ────────────────────────
  const dove = await p.evaluate(async ()=>{
    const out={};
    go('money'); await new Promise(r=>setTimeout(r,400));
    out.spese = document.getElementById('money').innerText;
    moneyVista('budget'); await new Promise(r=>setTimeout(r,400));
    out.budget = document.getElementById('moneyBudget').innerText;
    moneyVista('spese');
    openPeople(); await new Promise(r=>setTimeout(r,400));
    out.persone = document.body.innerText;
    closeSheet('mPeople');
    openExpense(); await new Promise(r=>setTimeout(r,400));
    out.nuovaSpesa = document.body.innerText;
    closeSheet('mExpense');
    return out;
  });
  ok('nelle Spese risulta il gruppo di due', /2 persone/.test(dove.spese), (dove.spese.match(/\d+ person\w+/)||[''])[0]);
  ok('nel Budget si può scegliere il compagno', /Jak/.test(dove.budget), (dove.budget.split('\n')[0]||''));
  ok('nell\'elenco Persone c\'è', /Jak/.test(dove.persone));
  ok('e si può assegnargli una spesa', /Jak/.test(dove.nuovaSpesa));
  await p.close();

  // ── 4. la casella vuota non deve inventare nessuno ───────────────────
  p = await apri();
  res = await creaViaggio(p, '', false);
  ok('senza compagni si resta da soli', res.partecipanti.length===1, res.partecipanti.join(', '));
  await p.close();

  // ── 5. più compagni: quelli confermati più quello ancora scritto ─────
  p = await apri();
  res = await p.evaluate(async ()=>{
    openNewTrip();
    document.getElementById('ntMe').value='Gepp';
    document.getElementById('ntName').value='Gita';
    const i=document.getElementById('ntPersonInput');
    i.value='Jak'; addNtPerson();
    i.value='Marco'; addNtPerson();
    i.value='Luca';            // questo resta scritto
    createTrip();
    await new Promise(r=>setTimeout(r,400));
    return { partecipanti:(T().participants||[]).map(x=>x.name) };
  });
  ok('ci sono tutti e quattro, anche l\'ultimo non confermato', res.partecipanti.length===4, res.partecipanti.join(', '));
  ok('e nell\'ordine in cui sono stati scritti', res.partecipanti.join(',')==='Gepp,Jak,Marco,Luca', res.partecipanti.join(', '));
  await p.close();

  console.log('\n'+r.join('\n'));
  const f=r.filter(x=>x.includes('FALLITO')).length;
  console.log(`\n${r.length-f}/${r.length} passati`);
  await b.close();
  process.exit(f?1:0);
})();
