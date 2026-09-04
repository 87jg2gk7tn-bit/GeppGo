const { apriBrowser, APP, RADICE, leafletJs } = require('./browser');
const fs = require('fs');
const stato = {trips:[{id:1730000000001,name:'Giappone 26',destination:'Osaka',currency:'JPY',status:'open',start:'2026-09-01',end:'2026-09-02',participants:[{id:'p1',name:'Gepp'}],suggested:[],pois:[],expenses:[],tickets:[],hotels:[],weather:{},createdAt:1,days:[{id:'d1',date:new Date().toISOString().split('T')[0],title:'',activities:[
 {id:1,name:'Kuromon',time:'09:30',timeEnd:'11:00',lat:34.6654,lng:135.5061,who:['p1'],completed:false,booking:{needed:false,done:false}},
 {id:2,name:'Dotonbori',time:'15:00',timeEnd:'16:00',lat:34.6687,lng:135.5013,who:['p1'],completed:false,booking:{needed:false,done:false}}]}]}],currentTripId:1730000000001,settings:{proxRadius:200},myName:'Gepp'};
(async () => {
  const b = await apriBrowser();
  const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
  const err=[]; p.on('pageerror', e=>err.push(e.message.split('\n')[0]));
  await p.route('**/leaflet@1.9.4/dist/leaflet.js', r=>r.fulfill({status:200,contentType:'application/javascript',body:fs.readFileSync(leafletJs(),'utf8')}));
  await p.route('**/tile.openstreetmap.org/**', r=>r.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64')}));
  await p.addInitScript(s=>localStorage.setItem('geppgo2',JSON.stringify(s)), stato);
  await p.goto('file:///home/user/GeppGo/Index%202.1.html',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>document.querySelector('.hh-acts'),{timeout:15000});
  await p.waitForTimeout(1200);

  const r=[]; const ok=(n,c,e='')=>r.push(`${c?'  OK  ':' FALLITO '} ${n}${e?' — '+e:''}`);

  const home = await p.evaluate(()=>[...document.querySelectorAll('.hh-acts .hh-act')].map(x=>x.textContent.trim()));
  ok('in home restano cinque tasti', home.length===5, home.length+': '+home.join(' | '));
  ok('e sono nell\'ordine giusto',
     home.join('|')==='🚻 Bagno vicino|🚬 Area fumatori|🏧 Bancomat|🎒 Bagagli|Condividi', home.join(' | '));
  const via=['Concludi','Rinomina','Giorni','Persone','Consigli','Salvato','Naviga la giornata','concludere'];
  via.forEach(v=>ok(`"${v}" non è più in home`, !home.some(x=>new RegExp(v,'i').test(x))));

  // la scheda del viaggio (dal Profilo) ha ancora tutto
  await p.evaluate(()=>openTripZoom(T().id));
  await p.waitForTimeout(600);
  const scheda = await p.evaluate(()=>document.getElementById('tripZoomBody').innerText);
  [['Concludi/stato',/concludere|in corso|in programma|conclus/i],['Rinomina',/Rinomina/],['Giorni',/Giorni/],
   ['Persone',/Persone/],['Consigli',/Consigli/],['Bagagli',/Bagagli/],['Salvato ora',/Salvato|Ripristin/i]]
   .forEach(([n,re])=>ok(`"${n}" c'è nella scheda del viaggio`, re.test(scheda)));

  // la scheda si raggiunge dal Profilo
  await p.evaluate(()=>{closeSheet('mTripZoom');go('trips');});
  await p.waitForTimeout(700);
  const dalProfilo = await p.evaluate(()=>{
    const c=[...document.querySelectorAll('#trips .hist-card')].find(x=>/Giappone/.test(x.textContent));
    if(!c)return 'nessuna scheda viaggio nel Profilo';
    c.click();
    return document.getElementById('mTripZoom').classList.contains('active')?'aperta':'non si è aperta';
  });
  ok('dal Profilo si apre la scheda del viaggio', dalProfilo==='aperta', dalProfilo);

  // "Naviga la giornata" è ancora in time-table
  const tt = await p.evaluate(()=>[...document.querySelectorAll('#mDay .chip')].map(x=>x.textContent.trim()));
  ok('"Naviga la giornata" è in time-table', tt.some(x=>/Naviga la giornata/.test(x)), tt.join(' | '));

  await p.evaluate(()=>{closeSheet('mTripZoom');go('plan');scrollTo(0,0);});
  await p.waitForTimeout(600);
  await p.screenshot({path:__dirname+'/tasti-home.png'});

  console.log('\n'+r.join('\n'));
  const f=r.filter(x=>x.includes('FALLITO')).length;
  console.log(`\n${r.length-f}/${r.length} passati`);
  if(err.length)console.log('\nErrori in pagina:\n'+err.slice(0,5).join('\n'));
  await b.close();
  process.exit(f?1:0);
})();
