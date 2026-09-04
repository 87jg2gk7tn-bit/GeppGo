const { apriBrowser, APP, RADICE, leafletJs } = require('./browser');
const fs = require('fs');
const oggi = new Date().toISOString().split('T')[0];
const stato = {trips:[{id:1730000000001,name:'Praga',destination:'Praga',currency:'EUR',status:'open',start:oggi,end:oggi,
  participants:[{id:'p1',name:'Gepp',isMe:true}],expenses:[],hotels:[],tickets:[],weather:{},createdAt:1,suggested:[],
  pois:[{id:9001,name:'Ponte Carlo',lat:50.0865,lng:14.4114,priority:'essential',address:'Karluv most, Praha'},
        {id:9002,name:'Castello',lat:50.0900,lng:14.4000,priority:'',address:'Hradcany'},
        {id:9003,name:'Museo Kafka',lat:50.0920,lng:14.4110,priority:'',address:'Cihelna 2'}],
  days:[{id:'d1',date:oggi,title:'',activities:[
    {id:1,name:'Museo Kafka',time:'10:00',timeEnd:'11:00',poiId:9003,lat:50.0920,lng:14.4110,who:['p1'],completed:false,booking:{needed:false,done:false}}
  ]}]}],currentTripId:1730000000001,settings:{proxRadius:200},myName:'Gepp'};
(async () => {
  const b = await apriBrowser();
  const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
  const err=[]; p.on('pageerror', e=>err.push(e.message.split('\n')[0]));
  await p.route('**/leaflet@1.9.4/dist/leaflet.js', r=>r.fulfill({status:200,contentType:'application/javascript',body:fs.readFileSync(leafletJs(),'utf8')}));
  await p.route('**/tile.openstreetmap.org/**', r=>r.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64')}));
  await p.addInitScript(s=>localStorage.setItem('geppgo2',JSON.stringify(s)), stato);
  await p.goto('file:///home/user/GeppGo/Index%202.1.html',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>typeof window.openDay==='function',{timeout:15000});
  await p.evaluate(()=>openDay(0));
  await p.waitForTimeout(900);

  const r=[]; const ok=(n,c,e='')=>r.push(`${c?'  OK  ':' FALLITO '} ${n}${e?' — '+e:''}`);

  // i tre tasti non sono più nella riga
  const chip = await p.evaluate(()=>[...document.querySelectorAll('#mDay .chip')].map(x=>x.textContent.trim()));
  ok('"Rientro in hotel" non è più nella riga', !chip.some(x=>/Rientro in hotel/.test(x)), chip.join(' | '));
  ok('"Importa lista" non è più nella riga', !chip.some(x=>/Importa lista/.test(x)));
  ok('"+ Foto" non è più nella riga', !chip.some(x=>/\+ Foto/.test(x)));
  ok('restano le quattro azioni sulla giornata', chip.length===4, chip.join(' | '));

  // il "+" apre il menu
  await p.evaluate(()=>addFromDay());
  await p.waitForTimeout(400);
  let m = await p.evaluate(()=>({aperto:document.getElementById('mAddScelta').classList.contains('active'),
                                testo:document.getElementById('addSceltaBody').innerText,
                                titolo:document.getElementById('addSceltaTitle').textContent}));
  ok('il "+" apre il menu', m.aperto);
  [['Nuova attività',/Nuova attività/],['Attività salvata',/Attività salvata/],['Rientro in hotel',/Rientro in hotel/],
   ['Foto',/Foto/],['Importa lista',/Importa lista/]].forEach(([che,re])=>ok(`nel menu c'è "${che}"`, re.test(m.testo)));
  ok('e dice quanti luoghi salvati sono liberi', /2 luoghi salvati/.test(m.testo), (m.testo.match(/\d+ luog\w+ salvat\w+[^\n]*/)||[''])[0]);

  // l'elenco dei salvati
  await p.evaluate(()=>addSceltaSalvate());
  await p.waitForTimeout(300);
  m = await p.evaluate(()=>({testo:document.getElementById('addSceltaBody').innerText, titolo:document.getElementById('addSceltaTitle').textContent}));
  ok('si apre l\'elenco dei luoghi salvati', /Luoghi salvati/.test(m.titolo), m.titolo);
  ok('c\'è il Ponte Carlo (non ancora in programma)', /Ponte Carlo/.test(m.testo));
  ok('c\'è il Castello', /Castello/.test(m.testo));
  ok('il Museo Kafka NON c\'è: è già in time-table', !/Kafka/.test(m.testo), m.testo.replace(/\n+/g,' / ').slice(0,110));
  ok('l\'essenziale sta in cima ed è segnato', m.testo.indexOf('Ponte Carlo')<m.testo.indexOf('Castello') && /essenziale/.test(m.testo));

  // aggiungo un salvato alla giornata
  await p.evaluate(()=>aggiungiPoiAlGiorno('9001'));
  await p.waitForTimeout(600);
  const dopo = await p.evaluate(()=>{
    const d=T().days[0];
    return { nomi:d.activities.map(a=>a.name), ultima:d.activities[d.activities.length-1],
             schedaAperta: document.getElementById('mActDetail').classList.contains('active'),
             menuChiuso: !document.getElementById('mAddScelta').classList.contains('active') };
  });
  ok('il luogo salvato entra nella giornata', dopo.nomi.includes('Ponte Carlo'), dopo.nomi.join(', '));
  ok('si porta dietro posizione e collegamento al luogo', dopo.ultima.poiId===9001 && dopo.ultima.lat===50.0865);
  ok('nasce senza orario, da mettere', dopo.ultima.time==='');
  ok('e si apre la sua scheda per metterlo', dopo.schedaAperta);
  ok('il menu si chiude', dopo.menuChiuso);

  // ora non è più fra i liberi
  await p.evaluate(()=>{closeSheet('mActDetail');addFromDay();});
  await p.waitForTimeout(400);
  const dopo2 = await p.evaluate(()=>document.getElementById('addSceltaBody').innerText);
  ok('e sparisce dai luoghi da mettere', /1 luogo salvato/.test(dopo2), (dopo2.match(/\d+ luog\w+ salvat\w+[^\n]*/)||[''])[0]);

  await p.screenshot({ path: __dirname+'/piu-menu.png' });
  await p.evaluate(()=>addSceltaSalvate());
  await p.waitForTimeout(300);
  await p.screenshot({ path: __dirname+'/piu-salvate.png' });

  console.log('\n'+r.join('\n'));
  const f=r.filter(x=>x.includes('FALLITO')).length;
  console.log(`\n${r.length-f}/${r.length} passati`);
  if(err.length) console.log('\nerrori: '+err.slice(0,3).join(' | '));
  await b.close();
  process.exit(f?1:0);
})();
