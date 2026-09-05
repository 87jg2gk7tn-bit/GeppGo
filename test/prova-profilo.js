const { apriBrowser, APP, RADICE, leafletJs } = require('./browser');
const fs = require('fs');
const stato = {trips:[{id:1730000000001,name:'Giappone 26',destination:'Osaka',currency:'JPY',status:'open',start:'2026-09-01',end:'2026-09-02',participants:[{id:'p1',name:'Gepp'}],suggested:[],pois:[],expenses:[],tickets:[],hotels:[],weather:{},createdAt:1,days:[{id:'d1',date:new Date().toISOString().split('T')[0],title:'',activities:[]}]}],currentTripId:1730000000001,settings:{proxRadius:200},myName:'Gepp'};
(async () => {
  const b = await apriBrowser();
  const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
  const err=[]; p.on('pageerror', e=>err.push(e.message.split('\n')[0]));
  await p.route('**/leaflet@1.9.4/dist/leaflet.js', r=>r.fulfill({status:200,contentType:'application/javascript',body:fs.readFileSync(leafletJs(),'utf8')}));
  await p.route('**/tile.openstreetmap.org/**', r=>r.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64')}));
  await p.addInitScript(s=>localStorage.setItem('geppgo2',JSON.stringify(s)), stato);
  await p.goto(APP,{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>typeof window.go==='function',{timeout:15000});
  await p.waitForTimeout(1500);

  const r=[]; const ok=(n,c,e='')=>r.push(`${c?'  OK  ':' FALLITO '} ${n}${e?' — '+e:''}`);

  // la barra
  const barra = await p.evaluate(()=>[...document.querySelectorAll('.nav-item')].map(x=>x.dataset.p));
  ok('la sezione Impostazioni non è più nella barra', !barra.includes('settings'), barra.join(' · '));
  ok('il Profilo è l\'ultima voce', barra[barra.length-1]==='trips', barra.join(' · '));
  ok('non ci sono più due icone uguali a sole', barra.filter(x=>x==='weather'||x==='settings').length===1);

  // il contenuto: tutto dentro il Profilo
  await p.evaluate(()=>{go('trips');scrollTo(0,0);});
  await p.waitForTimeout(700);
  const prof = await p.evaluate(()=>document.getElementById('trips').innerText);
  [['l\'account', /Il tuo account|Non connesso/],
   ['il tema scuro', /Tema scuro/],
   ['il diario', /Diario del viaggio/],
   ['i punti di ripristino', /Recupero/],
   ['i viaggi in corso', /In corso/i],
   ['i viaggi conclusi', /Conclusi/i],
   ['l\'etichetta che separa le impostazioni', /Impostazioni/i],
   ['il piano', /Piano/],
   ['gli avvisi di prossimità', /Avvisi di prossimità/],
   ['il calendario', /Calendario/],
   ['il navigatore', /Navigatore/],
   ['le copie di sicurezza', /Backup/],
   ['il reset', /Reset completo/]].forEach(([che,re])=>ok(`nel Profilo c'è ${che}`, re.test(prof)));

  // niente doppioni dell'account
  const quanti = (prof.match(/Account|Il tuo account|Non connesso/g)||[]).length;
  ok('l\'account compare una volta sola, non due', quanti===1, quanti+' volte');

  // i comandi che stavano in Impostazioni rispondono ancora
  const vivi = await p.evaluate(()=>{
    const q = s => !!document.getElementById(s);
    return { notifLevel:q('notifLevel'), proxRadius:q('proxRadius'), navPref:q('navPref'),
             funzioni:['saveProx','saveNav','exportICS','exportData','restoreBak','confirmReset','openPremium','updateAccountCard','renderProfile']
               .filter(f=>typeof window[f]!=='function') };
  });
  ok('le tendine delle notifiche e del navigatore ci sono', vivi.notifLevel&&vivi.proxRadius&&vivi.navPref);
  ok('tutte le funzioni collegate esistono ancora', vivi.funzioni.length===0, vivi.funzioni.join(', ')||'nessuna mancante');

  // updateAccountCard non deve più cercare pezzi che non esistono
  const dopo = await p.evaluate(()=>{ try{ updateAccountCard(); return 'ok'; }catch(e){ return 'ERRORE: '+e.message; } });
  ok('aggiornare la scheda account non dà errore', dopo==='ok', dopo);

  await p.screenshot({ path: __dirname+'/profilo.png', fullPage:false });
  console.log('\n'+r.join('\n'));
  const f=r.filter(x=>x.includes('FALLITO')).length;
  console.log(`\n${r.length-f}/${r.length} passati`);
  if(err.length) console.log('\nerrori in pagina: '+err.slice(0,4).join(' | '));
  await b.close();
  process.exit(f?1:0);
})();
