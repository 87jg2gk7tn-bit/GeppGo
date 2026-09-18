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
  /* IL PROFILO NON È PIÙ UNA VOCE DELLA BARRA. La barra in basso è per i
     posti dove si va camminando; nel Profilo ci si va da fermi, una volta
     ogni tanto, e si portava via un ottavo di una barra che già scorreva.
     Adesso sta in fondo al cassetto delle tre righine. */
  ok('il Profilo non è più una voce della barra in basso', !barra.includes('trips'), barra.join(' · '));
  ok('e la barra è scesa a sette voci', barra.length===7, barra.length+' voci');

  // ── e ci si arriva, dal cassetto, con un dito vero ───────────────────
  /* Togliere una voce dalla barra è mezzo lavoro: l'altra metà è che al
     Profilo ci si arrivi lo stesso. E si preme con `elementFromPoint`,
     non con .click(): il click salta il controllo di chi sta davvero
     sotto il dito, e l'ultima volta ha fatto passare una prova su un
     tasto che dal vivo era sepolto sotto il cassetto. */
  await p.evaluate(()=>{ go('plan'); });
  await p.waitForTimeout(400);
  const dito = await p.evaluate(async ()=>{
    const attendi = ms => new Promise(r2=>setTimeout(r2, ms));
    /* Il dito atterra su un punto e preme quello che quel punto comanda:
       spesso è il disegno dentro il tasto, e il tasto è chi lo contiene. */
    const premi = (el, dentro) => {
      const c = el.getBoundingClientRect();
      const sotto = document.elementFromPoint(c.left+c.width/2, c.top+c.height/2);
      const suo = sotto && sotto.closest(dentro);
      if(!suo) return 'sotto il dito c\'era: '+(sotto?(sotto.getAttribute('class')||sotto.tagName):'niente');
      suo.click();
      return null;
    };
    try{
      const righine = document.getElementById('menuViaggi');
      if(!righine) return { errore:'le tre righine non ci sono' };
      const g1 = premi(righine, '#menuViaggi');
      if(g1) return { errore:'sulle righine, '+g1 };
      await attendi(600);
      const voce = document.querySelector('#mViaggi .vg-profilo');
      if(!voce) return { errore:'nel cassetto non c\'è il Profilo' };
      const g2 = premi(voce, '.vg-profilo');
      if(g2) return { errore:'sul Profilo, '+g2 };
      await attendi(600);
      return {
        pagina: document.getElementById('trips').classList.contains('active'),
        cassettoChiuso: !document.getElementById('mViaggi').classList.contains('active')
      };
    }catch(e){ return { errore:'è saltato tutto: '+e.message }; }
  });
  ok('dalle tre righine si arriva al Profilo premendolo davvero',
     dito.pagina===true, dito.errore || ('pagina attiva: '+dito.pagina));
  /* Se il cassetto restasse aperto, la pagina si aprirebbe dietro una cosa
     che la copre: si sarebbe premuto e non sarebbe successo niente. */
  ok('e il cassetto si richiude dietro di sé', dito.cassettoChiuso===true, dito.errore||'');
  /* Impostazioni e Meteo avevano tutt'e due un sole per icona, e nella
     barra si leggeva come un doppione. Impostazioni è sparita dentro il
     Profilo, il Meteo è diventato il riquadro del cielo in cima alla home:
     nella barra di soli non ce n'è più nessuno. */
  ok('nella barra non c\'è più nessuna icona a sole', barra.filter(x=>x==='weather'||x==='settings').length===0, barra.join(' · '));

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
