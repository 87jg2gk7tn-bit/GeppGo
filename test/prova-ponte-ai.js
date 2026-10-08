/* IL PONTE DELL'ASSISTENTE, PROVATO A PARTE.

   worker/ponte-ai.js e' il Worker che sta su Cloudflare. Qui gira in Node,
   con un modello finto al posto di Workers AI e una Tavily finta al posto di
   quella vera: la prova decide cosa rispondono, e guarda cosa ricevono.
   1. le origini: il sito e localhost si', le altre no, anche nel preflight;
   2. i limiti: corpo, immagini, testo, messaggi, token della risposta;
   3. il formato: quello dell'app entra ed esce uguale, le foto arrivano al
      modello, il ragionamento ad alta voce sparisce, e se ha mangiato tutti
      i token si riprova una volta con piu' spazio;
   4. la quota finita: 429, il suo codice e l'ora del ritorno;
   5. «serve prenotare?»: una ricerca, fatta solo di luogo, destinazione, data;
   6. la chat: si cerca solo se il modello lo chiede, e a Tavily non arriva
      niente di personale, nemmeno se il modello ce lo mette;
   7. Tavily senza chiave, con la chiave sbagliata, senza crediti, giu':
      l'assistente risponde lo stesso e lo dice;
   8. un'app vecchia, che l'elenco non lo manda, non fa partire ricerche;
   9. /prova, la pagina che si apre dal telefono.
   Il file da provare si puo' cambiare con PONTE_AI: e' cosi' che si fa la
   controprova sul ponte di prima. */
const fs = require('fs');
const path = require('path');
const { RADICE } = require('./browser');

const FILE = process.env.PONTE_AI || path.join(RADICE, 'worker', 'ponte-ai.js');
const SITO = 'https://87jg2gk7tn-bit.github.io';
const MODELLO = '@cf/google/gemma-4-26b-a4b-it';
const r = [];
const ok = (nome, cond, extra = '') => r.push(`${cond ? '  OK  ' : ' FALLITO '} ${nome}${extra ? ' — ' + extra : ''}`);

/* Il modello finto: ogni chiamata prende la prossima risposta della fila
   (l'ultima resta). Un Error viene lanciato, come fa Workers AI. */
function modelloFinto(...risposte) {
  const chiamate = [];
  return {
    chiamate,
    run: async (modello, input) => {
      chiamate.push({ modello, input: JSON.parse(JSON.stringify(input)) });
      const x = risposte.length > 1 ? risposte.shift() : risposte[0];
      if (x instanceof Error) throw x;
      return typeof x === 'function' ? x(input) : x;
    }
  };
}
/* Tavily finta: si sostituisce fetch, e si tiene tutto quello che le arriva. */
const tavily = { chiamate: [], status: 200, cade: false,
  corpo: { results: [{ title: 'Torre de Belém — horário', url: 'https://www.torrebelem.gov.pt/horario',
    content: 'Aberta de terça a domingo, das 10:00 às 18:30. Encerra à segunda-feira.' }] } };
const fetchVero = globalThis.fetch;
globalThis.fetch = async (url, opz = {}) => {
  let corpo = null; try { corpo = JSON.parse(opz.body); } catch (e) {}
  tavily.chiamate.push({ url: String(url), headers: opz.headers || {}, corpo, grezzo: String(opz.body || ''), conTempo: !!opz.signal });
  if (tavily.cade) throw new TypeError('fetch failed');
  return new Response(JSON.stringify(tavily.corpo), { status: tavily.status, headers: { 'content-type': 'application/json' } });
};
const azzera = () => { tavily.chiamate.length = 0; tavily.status = 200; tavily.cade = false; };

let ponte;
async function manda(corpo, { origine = SITO, metodo = 'POST', percorso = '/', env = {}, grezzo = null } = {}) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (origine) headers.set('Origin', origine);
  const conCorpo = metodo === 'POST';
  const body = !conCorpo ? undefined : (grezzo != null ? grezzo : JSON.stringify(corpo));
  if (body != null) headers.set('Content-Length', String(Buffer.byteLength(body)));
  const res = await ponte.fetch(new Request('https://geppgo-ai.prova.workers.dev' + percorso, { method: metodo, headers, body }), env);
  const t = await res.text();
  let dati = null; try { dati = JSON.parse(t); } catch (e) {}
  return { status: res.status, headers: res.headers, dati, testo: t };
}
const domandaSemplice = (extra = {}) => Object.assign({ max_tokens: 900, system: 'Sei l\'assistente di viaggio.', messages: [{ role: 'user', content: 'Cosa vedo a Lisbona?' }] }, extra);
const RICERCA = { type: 'web_search_20250305', name: 'web_search' };
const PERSONALI = ['Marco', 'Rossi', 'marco.rossi', '@', '333', '+39', '1234567'];
const pulita = s => PERSONALI.filter(p => String(s).includes(p));

const prova = async (nome, fn) => { try { await fn(); } catch (e) { ok(nome, false, 'si è fermata: ' + e.message.split('\n')[0]); } };

(async () => {
  const src = fs.readFileSync(FILE, 'utf8');
  ponte = (await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'))).default;

  /* ── 1. origini ─────────────────────────────────────────────────────── */
  await prova('1', async () => {
    const esiti = {};
    for (const o of [SITO, 'http://localhost:8080', 'http://127.0.0.1:5173', 'https://altro-sito.example', 'null', '', 'http://localhost.altro.example']) {
      const ai = modelloFinto({ response: 'Ciao' });
      const x = await manda(domandaSemplice(), { origine: o, env: { AI: ai } });
      esiti[o || '(nessuna)'] = { status: x.status, acao: x.headers.get('access-control-allow-origin'), ai: ai.chiamate.length, tipo: x.dati && x.dati.error && x.dati.error.type };
    }
    ok('1. dal sito: risponde, e il browser può leggere la risposta', esiti[SITO].status === 200 && esiti[SITO].acao === SITO, JSON.stringify(esiti[SITO]));
    ok('1. da localhost, per le prove: risponde', esiti['http://localhost:8080'].status === 200 && esiti['http://127.0.0.1:5173'].status === 200);
    const fuori = ['https://altro-sito.example', 'null', '(nessuna)', 'http://localhost.altro.example'].map(k => esiti[k]);
    ok('1. da un altro sito, senza origine o con «null»: 403 «origine_non_ammessa», e il modello non si tocca',
       fuori.every(e => e.status === 403 && !e.acao && e.ai === 0 && e.tipo === 'origine_non_ammessa'), JSON.stringify(fuori));
    const pre = await manda(null, { metodo: 'OPTIONS' });
    const preNo = await manda(null, { metodo: 'OPTIONS', origine: 'https://altro-sito.example' });
    ok('1. il preflight dice di sì al sito e di no agli altri', pre.status === 204 && pre.headers.get('access-control-allow-origin') === SITO
       && /content-type/i.test(pre.headers.get('access-control-allow-headers') || '') && preNo.status === 403 && !preNo.headers.get('access-control-allow-origin'));
    const altro = await manda(domandaSemplice(), { origine: 'https://geppgo.app', env: { AI: modelloFinto({ response: 'Ciao' }), ORIGINI: 'https://geppgo.app, https://www.geppgo.app' } });
    ok('1. un dominio nuovo si aggiunge con la variabile ORIGINI, senza toccare il codice', altro.status === 200);
  });

  /* ── 2. limiti ──────────────────────────────────────────────────────── */
  await prova('2', async () => {
    const foto = n => Array.from({ length: n }, () => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } }));
    const casi = {
      'corpo da 1,6 MB': { grezzo: JSON.stringify(domandaSemplice({ system: 'x'.repeat(1600000) })) },
      'cinque immagini': { corpo: domandaSemplice({ messages: [{ role: 'user', content: foto(5).concat([{ type: 'text', text: 'cosa sono?' }]) }] }) },
      'una foto da 1,2 MB': { corpo: domandaSemplice({ messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'A'.repeat(1200000) } }] }] }) },
      'quarantuno messaggi': { corpo: domandaSemplice({ messages: Array.from({ length: 41 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'ciao' })) }) },
      'troppo testo': { corpo: domandaSemplice({ system: 'y'.repeat(160000) }) }
    };
    const esiti = {};
    for (const [k, c] of Object.entries(casi)) {
      const ai = modelloFinto({ response: 'x' });
      const x = await manda(c.corpo, { grezzo: c.grezzo || null, env: { AI: ai } });
      esiti[k] = { status: x.status, tipo: x.dati && x.dati.error && x.dati.error.type, ai: ai.chiamate.length };
    }
    ok('2. corpo, immagini, foto, messaggi e testo oltre i limiti: 413 «troppo_grande», senza spendere il modello',
       Object.values(esiti).every(e => e.status === 413 && e.tipo === 'troppo_grande' && e.ai === 0), JSON.stringify(esiti));
    const storti = {};
    for (const [k, g] of Object.entries({ 'non JSON': '{rotto', 'senza messaggi': '{"system":"x"}', 'ruolo inventato': JSON.stringify({ messages: [{ role: 'system', content: 'x' }] }),
      'immagine gif': JSON.stringify({ messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/gif', data: 'AAAA' } }] }] }) })) {
      const ai = modelloFinto({ response: 'x' });
      const x = await manda(null, { grezzo: g, env: { AI: ai } });
      storti[k] = { status: x.status, ai: ai.chiamate.length };
    }
    ok('2. richieste storte: 400, senza spendere il modello', Object.values(storti).every(e => e.status === 400 && e.ai === 0), JSON.stringify(storti));
    const token = [];
    for (const m of [99999, undefined, 10]) {
      const ai = modelloFinto({ response: 'x' });
      await manda(domandaSemplice({ max_tokens: m }), { env: { AI: ai } });
      token.push(ai.chiamate[0] && ai.chiamate[0].input.max_tokens);
    }
    ok('2. i token della risposta restano fra 64 e 4096 (1024 se non detti)', JSON.stringify(token) === '[4096,1024,64]', JSON.stringify(token));
  });

  /* ── 3. formato ─────────────────────────────────────────────────────── */
  await prova('3', async () => {
    const ai = modelloFinto({ response: '{"nome":"Torre di Belém","certezza":"alta"}' });
    const x = await manda({ max_tokens: 1200, system: 'Riconosci il posto.', messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: '/9j/AAAA' } },
      { type: 'text', text: 'Che posto è?' }] }] }, { env: { AI: ai } });
    const inv = ai.chiamate[0] || { input: { messages: [] } };
    const m = inv.input.messages;
    ok('3. al modello arrivano il sistema e la foto, nella forma che Workers AI capisce', inv.modello === MODELLO && m[0].role === 'system' && m[0].content === 'Riconosci il posto.'
       && Array.isArray(m[1].content) && m[1].content.some(p => p.type === 'image_url' && p.image_url.url === 'data:image/jpeg;base64,/9j/AAAA') && m[1].content.some(p => p.type === 'text'),
       JSON.stringify(m).slice(0, 200));
    ok('3. e all\'app torna il formato di sempre', x.status === 200 && x.dati && x.dati.stop_reason === 'end_turn' && x.dati.content[0].type === 'text'
       && x.dati.content[0].text.includes('Torre di Belém') && !('ricerca' in x.dati), x.testo.slice(0, 120));
    const scelte = await manda(domandaSemplice(), { env: { AI: modelloFinto({ choices: [{ message: { role: 'assistant', content: '<think>vediamo...</think>Il Castello di São Jorge, al tramonto.' } }] }) } });
    ok('3. anche la forma «choices», e il ragionamento ad alta voce non arriva', scelte.dati && scelte.dati.content[0].text === 'Il Castello di São Jorge, al tramonto.', scelte.testo.slice(0, 120));
    const altro = modelloFinto({ response: 'ok' });
    await manda(domandaSemplice(), { env: { AI: altro, MODELLO: '@cf/google/gemma-5-prova' } });
    ok('3. il modello si cambia con la variabile MODELLO', altro.chiamate[0] && altro.chiamate[0].modello === '@cf/google/gemma-5-prova');
    const vuota = await manda(domandaSemplice(), { env: { AI: modelloFinto({ response: '   ' }) } });
    const senza = await manda(domandaSemplice(), { env: {} });
    ok('3. risposta vuota o collegamento AI mancante: 502, che l\'app sa ritentare', vuota.status === 502 && senza.status === 502
       && /collegamento AI/.test((senza.dati && senza.dati.error && senza.dati.error.message) || ''), JSON.stringify([vuota.dati, senza.dati]));
    const gemma = await manda(domandaSemplice(), { env: { AI: modelloFinto({ choices: [{ message: { content: '<|channel>thought\nL\'utente vuole...<channel|>Il Castello di São Jorge.' } }] }) } });
    ok('3. anche il ragionamento nella forma di Gemma non arriva', gemma.dati && gemma.dati.content[0].text === 'Il Castello di São Jorge.', gemma.testo.slice(0, 120));
    const pensa = modelloFinto({ choices: [{ message: { content: '', reasoning_content: 'Vediamo, Lisbona...' }, finish_reason: 'length' }] },
      { choices: [{ message: { content: 'Il Mosteiro dos Jerónimos.' }, finish_reason: 'stop' }] });
    const dopo = await manda(domandaSemplice(), { env: { AI: pensa } });
    ok('3. se il ragionamento ha finito i token e la risposta è vuota, si riprova una volta con il doppio dello spazio',
       dopo.status === 200 && dopo.dati.content[0].text === 'Il Mosteiro dos Jerónimos.' && pensa.chiamate.length === 2
       && pensa.chiamate[0].input.max_tokens === 900 && pensa.chiamate[1].input.max_tokens === 1800, pensa.chiamate.map(c => c.input.max_tokens).join(' → '));
    const sempre = modelloFinto({ choices: [{ message: { content: '' }, finish_reason: 'length' }] });
    const finita = await manda(domandaSemplice(), { env: { AI: sempre } });
    ok('3. e una volta sola: se resta vuota è un 502', finita.status === 502 && sempre.chiamate.length === 2, sempre.chiamate.length + ' chiamate');
    const nudo = modelloFinto({ response: 'ok' }), conOpz = modelloFinto({ response: 'ok' });
    await manda(domandaSemplice(), { env: { AI: nudo } });
    await manda(domandaSemplice(), { env: { AI: conOpz, OPZIONI_MODELLO: '{"chat_template_kwargs":{"enable_thinking":false},"messages":[],"max_tokens":5}' } });
    const i1 = (nudo.chiamate[0] || {}).input || {}, i2 = (conOpz.chiamate[0] || {}).input || {};
    ok('3. senza OPZIONI_MODELLO al modello non va niente in più di messaggi e token', Object.keys(i1).sort().join(',') === 'max_tokens,messages', Object.keys(i1).join(','));
    ok('3. con OPZIONI_MODELLO le opzioni si aggiungono, ma messaggi e token restano quelli del ponte',
       i2.chat_template_kwargs && i2.chat_template_kwargs.enable_thinking === false && i2.messages.length === 2 && i2.max_tokens === 900, JSON.stringify(i2).slice(0, 160));
  });

  /* ── 4. quota finita ────────────────────────────────────────────────── */
  await prova('4', async () => {
    const prima = Date.now();
    const x = await manda(domandaSemplice(), { env: { AI: modelloFinto(new Error('4006: you have used up your daily free allocation of 10,000 neurons, please upgrade to Cloudflare\'s Workers Paid plan')) } });
    const e = (x.dati && x.dati.error) || {};
    const t = Date.parse(e.riprova_alle || '');
    ok('4. quota finita: 429 con tipo «quota_finita»', x.status === 429 && e.type === 'quota_finita' && x.headers.get('access-control-allow-origin') === SITO, x.testo.slice(0, 160));
    ok('4. e l\'ora del ritorno: la prossima mezzanotte UTC', /T00:00:00\.000Z$/.test(e.riprova_alle || '') && t > prima && t - prima <= 864e5, e.riprova_alle || 'nessuna');
    const altro = await manda(domandaSemplice(), { env: { AI: modelloFinto(new Error('InferenceUpstreamError: internal')) } });
    ok('4. un altro guasto del modello resta un 502 «errore_modello»', altro.status === 502 && altro.dati.error.type === 'errore_modello');
  });

  /* ── 5. «serve prenotare?» ──────────────────────────────────────────── */
  await prova('5', async () => {
    azzera();
    const ai = modelloFinto({ response: '{"prenotare":"consigliata","giorni_prima":2,"motivo":"in alta stagione c\'è coda","sito":""}' });
    const x = await manda(domandaSemplice({ tools: [RICERCA], messages: [{ role: 'user', content: 'Cerca sul web se "Torre di Belém" (Lisbona) richiede la prenotazione.' }],
      ricerca: { scopo: 'prenotare', luoghi: ['Torre di Belém'], destinazione: 'Lisbona', date: ['2026-11-02'] } }), { env: { AI: ai, TAVILY_KEY: 'tvly-prova' } });
    const c = tavily.chiamate[0] || { corpo: {}, headers: {} };
    ok('5. una ricerca sola, con la chiave nel posto giusto e un tempo massimo', tavily.chiamate.length === 1 && c.url === 'https://api.tavily.com/search' && c.headers.Authorization === 'Bearer tvly-prova' && c.conTempo, tavily.chiamate.length + ' ricerche');
    ok('5. la domanda a Tavily è fatta di luogo, destinazione, argomento e data, e basta',
       c.corpo.query === 'Torre di Belém Lisbona tickets booking reservation required 2026-11-02' && c.corpo.max_results === 5 && c.corpo.include_raw_content === false, c.corpo.query);
    const sis = ((ai.chiamate[0] || {}).input || { messages: [{}] }).messages[0].content || '';
    ok('5. il modello riceve i risultati, e all\'app torna «ricerca: fatta»', /RISULTATI DI UNA RICERCA SUL WEB/.test(sis) && sis.includes('torrebelem.gov.pt') && x.dati && x.dati.ricerca === 'fatta' && ai.chiamate.length === 1);
  });

  /* ── 6. chat: privacy ───────────────────────────────────────────────── */
  await prova('6', async () => {
    azzera();
    const elenco = { scopo: 'chat', luoghi: ['Torre di Belém', 'Oceanário de Lisboa', 'Cena da mario@esempio.it', 'Taxi +351 21 811 1100'], destinazione: 'Lisbona', date: ['2026-11-02', '2026-11-03'] };
    const domanda = 'Sono Marco Rossi (marco.rossi@esempio.it, +39 333 1234567): a che ora apre domani la Torre di Belém?';
    const ai = modelloFinto({ response: 'CERCA: orari | Torre di Belém, Marco Rossi marco.rossi@esempio.it +39 333 1234567 | 2026-11-03' },
      { response: 'Domani apre alle 10:00 (dal sito torrebelem.gov.pt).' });
    const x = await manda(domandaSemplice({ tools: [RICERCA], messages: [{ role: 'user', content: domanda }], ricerca: elenco }), { env: { AI: ai, TAVILY_KEY: 'tvly-prova' } });
    const q = (tavily.chiamate[0] || { corpo: {} }).corpo.query || '';
    ok('6. il modello chiede di cercare: la domanda a Tavily è solo luogo, destinazione, argomento e data', q === 'Torre di Belém Lisbona opening hours 2026-11-03', q);
    ok('6. a Tavily non arriva niente di personale, nemmeno quello che il modello ci ha messo', tavily.chiamate.length === 1 && !pulita(tavily.chiamate[0].grezzo).length,
       pulita(tavily.chiamate.map(c => c.grezzo).join(' ')).join(', ') || 'niente');
    const primo = ((ai.chiamate[0] || {}).input || { messages: [{}] }).messages[0].content || '';
    const secondo = ((ai.chiamate[1] || {}).input || { messages: [{}] }).messages[0].content || '';
    ok('6. nell\'elenco dato al modello non entrano le voci con email o telefono', /CERCA: argomento \| luogo \| data/.test(primo) && primo.includes('Oceanário de Lisboa')
       && !primo.includes('mario@') && !primo.includes('811 1100'));
    ok('6. poi la risposta, con i risultati davanti e senza l\'istruzione di cercare', ai.chiamate.length === 2 && /RISULTATI DI UNA RICERCA/.test(secondo) && !/CERCA: argomento/.test(secondo)
       && x.dati.content[0].text === 'Domani apre alle 10:00 (dal sito torrebelem.gov.pt).' && x.dati.ricerca === 'fatta');
    azzera();
    const ai2 = modelloFinto({ response: 'CERCA: trasporti | Marco Rossi | domani' }, { response: 'Prendi il tram 15.' });
    await manda(domandaSemplice({ tools: [RICERCA], messages: [{ role: 'user', content: domanda }], ricerca: elenco }), { env: { AI: ai2, TAVILY_KEY: 'tvly-prova' } });
    const q2 = (tavily.chiamate[0] || { corpo: {} }).corpo.query || '';
    ok('6. un luogo che non è nell\'elenco non passa: resta la destinazione', q2 === 'Lisbona public transport how to get there' && !pulita(q2).length, q2);
    azzera();
    const ai3 = modelloFinto({ response: 'Al tramonto, il Miradouro da Senhora do Monte.' });
    const y = await manda(domandaSemplice({ tools: [RICERCA], ricerca: elenco }), { env: { AI: ai3, TAVILY_KEY: 'tvly-prova' } });
    ok('6. una domanda che non chiede fatti aggiornati: nessuna ricerca, una chiamata sola', tavily.chiamate.length === 0 && ai3.chiamate.length === 1 && !('ricerca' in y.dati));
  });

  /* ── 7. Tavily che non c'è ──────────────────────────────────────────── */
  await prova('7', async () => {
    const esiti = {};
    const casi = { 'senza chiave': { env: {} }, 'chiave sbagliata (401)': { status: 401 }, 'crediti finiti (432)': { status: 432 }, 'Tavily in errore (500)': { status: 500 }, 'Tavily giù': { cade: true } };
    for (const [k, c] of Object.entries(casi)) {
      azzera();
      if (c.status) tavily.status = c.status;
      if (c.cade) tavily.cade = true;
      const ai = modelloFinto({ response: '{"prenotare":"no","motivo":"","sito":""}' });
      const env = Object.assign({ AI: ai, TAVILY_KEY: 'tvly-prova' }, c.env || {});
      if (c.env) delete env.TAVILY_KEY;
      const x = await manda(domandaSemplice({ tools: [RICERCA], ricerca: { scopo: 'prenotare', luoghi: ['Torre di Belém'], destinazione: 'Lisbona', date: [] } }), { env });
      const sis = ((ai.chiamate[0] || {}).input || { messages: [{}] }).messages[0].content || '';
      esiti[k] = { status: x.status, ricerca: x.dati && x.dati.ricerca, avvisato: /non e' disponibile/.test(sis), tavily: tavily.chiamate.length };
    }
    ok('7. senza chiave non si chiama Tavily, e l\'assistente risponde lo stesso: «non_configurata»',
       esiti['senza chiave'].status === 200 && esiti['senza chiave'].ricerca === 'non_configurata' && esiti['senza chiave'].tavily === 0 && esiti['senza chiave'].avvisato, JSON.stringify(esiti['senza chiave']));
    ok('7. chiave sbagliata: «non_configurata»; crediti finiti: «crediti_finiti»; guasti: «non_riuscita» — sempre con la risposta',
       esiti['chiave sbagliata (401)'].ricerca === 'non_configurata' && esiti['crediti finiti (432)'].ricerca === 'crediti_finiti'
       && esiti['Tavily in errore (500)'].ricerca === 'non_riuscita' && esiti['Tavily giù'].ricerca === 'non_riuscita'
       && Object.values(esiti).every(e => e.status === 200 && e.avvisato), JSON.stringify(esiti));
  });

  /* ── 8. un'app vecchia ──────────────────────────────────────────────── */
  await prova('8', async () => {
    azzera();
    const ai = modelloFinto({ response: 'Ecco gli orari che conosco.' });
    const x = await manda(domandaSemplice({ tools: [RICERCA] }), { env: { AI: ai, TAVILY_KEY: 'tvly-prova' } });
    const sis = ((ai.chiamate[0] || {}).input || { messages: [{}] }).messages[0].content || '';
    ok('8. senza l\'elenco di cosa si può cercare (un\'app vecchia) non parte nessuna ricerca', x.status === 200 && tavily.chiamate.length === 0 && ai.chiamate.length === 1
       && sis === 'Sei l\'assistente di viaggio.' && !('ricerca' in x.dati));
  });

  /* ── 9. /prova ──────────────────────────────────────────────────────── */
  await prova('9', async () => {
    azzera();
    const ai = modelloFinto({ response: 'Il Mosteiro dos Jerónimos.', usage: { prompt_tokens: 21, completion_tokens: 9 } }, { response: 'Rosso.' });
    const p = await manda(null, { metodo: 'GET', percorso: '/prova?foto=1', origine: '', env: { AI: ai } });
    ok('9. /prova dice se il modello risponde, con quanti token, e se la ricerca è configurata', p.status === 200 && /ASSISTENTE: FUNZIONA/.test(p.testo) && /token 21 in entrata e 9 in uscita/.test(p.testo)
       && /RICERCA WEB: non configurata/.test(p.testo) && p.testo.includes(MODELLO), p.testo.slice(0, 160));
    ok('9. /prova?foto=1 manda davvero una foto al modello', /FOTO: FUNZIONA/.test(p.testo) && ai.chiamate.length === 2 && JSON.stringify(ai.chiamate[1].input).includes('data:image/jpeg;base64,'));
    const senza = await manda(null, { metodo: 'GET', percorso: '/prova', origine: '', env: {} });
    ok('9. senza il collegamento AI lo dice, con dove si mette', /manca il collegamento «AI»/.test(senza.testo));
    const cerca = await manda(null, { metodo: 'GET', percorso: '/prova?ricerca=1', origine: '', env: { AI: modelloFinto({ response: 'ok' }), TAVILY_KEY: 'tvly-prova' } });
    ok('9. /prova?ricerca=1 fa una ricerca vera, una', /RICERCA WEB: FUNZIONA/.test(cerca.testo) && tavily.chiamate.length === 1, cerca.testo.split('\n').filter(l => /RICERCA/.test(l)).join(' '));
    const ragiona = await manda(null, { metodo: 'GET', percorso: '/prova', origine: '', env: { AI: modelloFinto({ choices: [{ message: { content: 'Belém.', reasoning_content: 'Vediamo...' } }] }) } });
    ok('9. /prova dice anche se il modello ragiona prima di rispondere', /FUNZIONA.*ragiona prima di rispondere/.test(ragiona.testo), ragiona.testo.split('\n')[0]);
    const home = await manda(null, { metodo: 'GET', origine: '', env: {} });
    const put = await manda(domandaSemplice(), { metodo: 'PUT', env: {} });
    ok('9. l\'indirizzo nudo dice che il ponte è vivo, e un metodo diverso da POST no', home.status === 200 && /Ponte GeppGo attivo/.test(home.testo) && put.status === 405);
  });

  globalThis.fetch = fetchVero;
  console.log('\n' + r.join('\n'));
  const falliti = r.filter(x => x.includes('FALLITO')).length;
  console.log(`\n${r.length - falliti}/${r.length} passati`);
  process.exit(falliti ? 1 : 0);
})();
