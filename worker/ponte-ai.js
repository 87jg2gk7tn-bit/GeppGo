/* PONTE GEPPGO → ASSISTENTE
   Cloudflare Workers AI (il modello) e Tavily (la ricerca sul web).

   Questo file si incolla cosi' com'e' nella dashboard di Cloudflare (Workers
   → geppgo-ai → Modifica codice). Come pubblicarlo dal telefono, con il
   collegamento al modello e la chiave della ricerca: GUIDA-AI.md.

   Perche' cosi'. Prima il ponte girava le richieste a un servizio che, sul
   piano gratuito, non e' permesso a chi offre un'app a persone in Europa.
   Workers AI gira dentro lo stesso account Cloudflare del ponte: niente
   chiave da custodire per il modello, niente addestramento sui dati, e
   quando la quota gratuita del giorno finisce le richieste si fermano invece
   di costare qualcosa.

   Il formato con l'app non cambia: l'app parla come prima, e la traduzione
   la fa questo file. Cosi' l'app funziona sia con il ponte vecchio sia con
   questo, e l'ordine in cui si pubblicano le due cose non conta. Rispetto a
   prima ci sono due campi in piu', tutti e due facoltativi: «ricerca» nella
   domanda (dice cosa si puo' cercare sul web) e «ricerca» nella risposta
   (dice se la ricerca c'e' stata). Chi non li conosce li ignora.

   Nessuna chiave sta qui dentro: quella di Tavily e' un secret del Worker
   (TAVILY_KEY), il modello arriva dal collegamento «AI» del Worker. */

/* Il modello. Si puo' cambiare senza toccare il codice, con la variabile
   MODELLO nelle impostazioni del Worker: i modelli si ritirano, e allora
   basta scriverne un altro. */
const MODELLO = '@cf/google/gemma-4-26b-a4b-it';

/* Da dove possono arrivare le richieste. Il sito e' su GitHub Pages; le
   prove girano in locale. Un altro indirizzo (per esempio il giorno che
   l'app avra' un dominio suo) si aggiunge con la variabile ORIGINI, senza
   toccare il codice. Non e' una serratura - chi scrive un programma apposta
   puo' fingere l'origine - ma tiene fuori le pagine degli altri, che dal
   browser non possono farlo. */
const ORIGINI = ['https://87jg2gk7tn-bit.github.io'];
const IN_LOCALE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

/* I limiti. Sul piano gratuito un Worker ha pochi millesimi di calcolo per
   richiesta: leggere un corpo enorme se li mangerebbe tutti. E nessuna
   richiesta dell'app si avvicina a questi numeri: una foto ridisegnata pesa
   qualche centinaio di KB, tre pagine scansionate meno di un mega. */
const MAX_CORPO = 1500000;      // byte della richiesta
const MAX_IMMAGINI = 4;          // per richiesta
const MAX_IMMAGINE = 1100000;    // caratteri di una foto in base64
const MAX_TESTO = 150000;        // caratteri di testo in tutto
const MAX_MESSAGGI = 40;
const MAX_TOKEN = 4096;          // token della risposta

/* La ricerca sul web. A Tavily vanno SOLO nomi di luoghi, la destinazione,
   una data e un argomento preso da questo elenco: mai il testo scritto da chi
   usa l'app, mai quello che propone il modello cosi' com'e'. I luoghi e le
   date ammessi li manda l'app (campo «ricerca»), che ci mette solo posti del
   viaggio; qui si ricontrolla tutto lo stesso. Se l'app non manda l'elenco
   (un'app vecchia), non si cerca niente. */
const TAVILY = 'https://api.tavily.com/search';
const ARGOMENTI = {
  orari: 'opening hours',
  prenotare: 'tickets booking reservation required',
  biglietti: 'tickets',
  trasporti: 'public transport how to get there',
  eventi: 'events',
  chiusure: 'closures',
  prezzi: 'prices',
  meteo: 'weather forecast'
};

/* Una foto rossa di 24 pixel, per controllare da /prova?foto=1 che il
   modello veda davvero le immagini. */
const FOTO_DI_PROVA = '/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAYABgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAUG/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AkgJzZAAAAAAP/9k=';

export default {
  async fetch(req, env) {
    env = env || {};
    const url = new URL(req.url);
    const origine = req.headers.get('Origin') || '';
    const ammessa = origineAmmessa(origine, env);
    const cors = ammessa
      ? { 'Access-Control-Allow-Origin': origine, 'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' }
      : { 'Vary': 'Origin' };

    if (req.method === 'OPTIONS') return new Response(null, { status: ammessa ? 204 : 403, headers: cors });
    /* Le pagine di controllo si aprono dal browser del telefono, dove una
       visita diretta non ha origine: per questo non chiedono l'origine. */
    if (req.method === 'GET') {
      if (url.pathname === '/prova') return prova(env, url);
      return testo('Ponte GeppGo attivo');
    }
    if (req.method !== 'POST') return errore(405, 'metodo', 'si usa POST', cors);
    if (!ammessa) return errore(403, 'origine_non_ammessa', 'origine non ammessa: ' + (origine || 'nessuna'), cors);

    if (+(req.headers.get('Content-Length') || 0) > MAX_CORPO) return errore(413, 'troppo_grande', 'richiesta troppo grande', cors);
    const grezzo = await req.text();
    if (grezzo.length > MAX_CORPO) return errore(413, 'troppo_grande', 'richiesta troppo grande', cors);
    let a;
    try { a = JSON.parse(grezzo); } catch (e) { return errore(400, 'richiesta_non_leggibile', 'non e\' JSON', cors); }
    const no = controlla(a);
    if (no) return errore(no.status, no.tipo, no.motivo, cors);

    try {
      const esito = await rispondi(a, env);
      const corpo = { content: [{ type: 'text', text: esito.testo }], stop_reason: 'end_turn' };
      if (esito.ricerca) corpo.ricerca = esito.ricerca;
      return json(corpo, 200, cors);
    } catch (e) {
      /* La quota gratuita finita ha un codice suo, e l'ora in cui torna: e'
         l'unico errore per cui chi usa l'app puo' sapere quando riprovare. */
      if (quotaFinita(e)) {
        return json({ error: { type: 'quota_finita', message: 'quota gratuita del giorno finita',
          riprova_alle: prossimaMezzanotteUTC() } }, 429, cors);
      }
      return errore(502, 'errore_modello', String((e && e.message) || e).slice(0, 300), cors);
    }
  }
};

function origineAmmessa(o, env) {
  if (!o) return false;
  if (IN_LOCALE.test(o)) return true;
  const altre = String(env.ORIGINI || '').split(',').map(x => x.trim()).filter(Boolean);
  return ORIGINI.concat(altre).includes(o);
}

/* Si controlla la forma prima di spendere qualcosa: una richiesta storta o
   esagerata si ferma qui, senza toccare la quota del modello. */
function controlla(a) {
  if (!a || typeof a !== 'object' || !Array.isArray(a.messages) || !a.messages.length) {
    return { status: 400, tipo: 'richiesta_non_valida', motivo: 'mancano i messaggi' };
  }
  if (a.messages.length > MAX_MESSAGGI) return { status: 413, tipo: 'troppo_grande', motivo: 'troppi messaggi' };
  let testo = typeof a.system === 'string' ? a.system.length : 0, foto = 0;
  for (const m of a.messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return { status: 400, tipo: 'richiesta_non_valida', motivo: 'ruolo non valido' };
    if (typeof m.content === 'string') { testo += m.content.length; continue; }
    if (!Array.isArray(m.content)) return { status: 400, tipo: 'richiesta_non_valida', motivo: 'contenuto non valido' };
    for (const b of m.content) {
      if (b && b.type === 'text') testo += String(b.text || '').length;
      else if (b && b.type === 'image') {
        foto++;
        const s = b.source || {};
        if (s.type !== 'base64' || !/^image\/(jpeg|png|webp)$/.test(s.media_type || '') || typeof s.data !== 'string') {
          return { status: 400, tipo: 'richiesta_non_valida', motivo: 'immagine non valida' };
        }
        if (s.data.length > MAX_IMMAGINE) return { status: 413, tipo: 'troppo_grande', motivo: 'immagine troppo grande' };
      } else return { status: 400, tipo: 'richiesta_non_valida', motivo: 'blocco sconosciuto' };
    }
  }
  if (foto > MAX_IMMAGINI) return { status: 413, tipo: 'troppo_grande', motivo: 'troppe immagini' };
  if (testo > MAX_TESTO) return { status: 413, tipo: 'troppo_grande', motivo: 'troppo testo' };
  return null;
}

/* ---- dal formato dell'app a quello di Workers AI ---- */
function messaggiPerModello(a, aggiunta) {
  const sistema = [typeof a.system === 'string' ? a.system : '', aggiunta || ''].filter(Boolean).join('\n\n');
  const out = sistema ? [{ role: 'system', content: sistema }] : [];
  for (const m of a.messages) {
    if (typeof m.content === 'string') { out.push({ role: m.role, content: m.content }); continue; }
    const pezzi = m.content.map(b => b.type === 'text'
      ? { type: 'text', text: String(b.text || '') }
      : { type: 'image_url', image_url: { url: 'data:' + b.source.media_type + ';base64,' + b.source.data } });
    /* Un messaggio di solo testo resta testo semplice: e' la forma che tutti
       i modelli capiscono. */
    out.push({ role: m.role, content: pezzi.every(p => p.type === 'text') ? pezzi.map(p => p.text).join('\n') : pezzi });
  }
  return out;
}

async function modello(env, messaggi, maxToken) {
  if (!env.AI || typeof env.AI.run !== 'function') throw new Error('manca il collegamento AI del Worker');
  const chiedi = n => env.AI.run(env.MODELLO || MODELLO, Object.assign({}, opzioniModello(env), { messages: messaggi, max_tokens: n }));
  let r = await chiedi(maxToken);
  let t = testoDa(r);
  /* Un modello che ragiona prima di rispondere puo' spendere tutti i token
     nel ragionamento e lasciare vuota la risposta: una volta sola si riprova
     con il doppio dello spazio, invece di dire all'app che non ha risposto. */
  if (!t && tagliata(r) && maxToken < MAX_TOKEN * 2) {
    r = await chiedi(Math.min(maxToken * 2, MAX_TOKEN * 2));
    t = testoDa(r);
  }
  if (!t) throw new Error('risposta vuota');
  return t;
}
function tagliata(r) {
  const c = r && r.choices && r.choices[0];
  return !!((c && c.finish_reason === 'length') || (r && r.finish_reason === 'length'));
}
/* Opzioni in piu' per il modello, dalla variabile OPZIONI_MODELLO (un JSON):
   per esempio quella che spegne il ragionamento, se un modello la vuole.
   Senza la variabile non si manda niente in piu': un'opzione che il modello
   non conosce puo' far rifiutare la richiesta. Messaggi e token restano
   quelli di qui. */
function opzioniModello(env) {
  try {
    const o = JSON.parse(env.OPZIONI_MODELLO || '{}');
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch (e) { return {}; }
}
/* Se il modello ha ragionato prima di rispondere: /prova lo dice, perche'
   il ragionamento consuma la quota del giorno. */
function haRagionato(r) {
  const m = r && r.choices && r.choices[0] && r.choices[0].message;
  const grezzo = typeof (r && r.response) === 'string' ? r.response : (m && typeof m.content === 'string' ? m.content : '');
  return !!((m && (m.reasoning_content || m.reasoning)) || /<think|<\|?channel\|?>\s*thought/i.test(grezzo));
}

/* ---- da Workers AI al formato dell'app ----
   I modelli di Workers AI non rispondono tutti nella stessa forma: alcuni
   danno { response }, altri la forma «chat completions» con choices. Si
   accettano tutte e due, e si toglie l'eventuale ragionamento ad alta voce,
   che all'app non serve e nel JSON fa danni. */
function testoDa(r) {
  if (r == null) return '';
  if (typeof r === 'string') return pulisci(r);
  if (typeof r.response === 'string') return pulisci(r.response);
  if (r.response && typeof r.response === 'object') return JSON.stringify(r.response);
  const m = r.choices && r.choices[0] && r.choices[0].message;
  if (m) {
    if (typeof m.content === 'string') return pulisci(m.content);
    if (Array.isArray(m.content)) return pulisci(m.content.map(p => (p && (p.text || '')) || '').join(''));
  }
  if (typeof r.output_text === 'string') return pulisci(r.output_text);
  if (r.result) return testoDa(r.result);
  return '';
}
function pulisci(s) {
  return String(s).replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    /* il ragionamento di Gemma, quando arriva nel testo invece che a parte */
    .replace(/<\|?channel\|?>\s*thought\b[\s\S]*?<\|?channel\|?>/gi, '').trim();
}

/* ---- la risposta, con o senza ricerca ---- */
async function rispondi(a, env) {
  const maxToken = Math.min(Math.max(parseInt(a.max_tokens, 10) || 1024, 64), MAX_TOKEN);
  const vuoleRicerca = (a.tools || []).some(t => String((t && t.type) || '').startsWith('web_search'));
  const elenco = vuoleRicerca && a.ricerca && typeof a.ricerca === 'object' ? elencoRicerca(a.ricerca) : null;
  if (!elenco || (!elenco.luoghi.length && !elenco.destinazione)) {
    return { testo: await modello(env, messaggiPerModello(a), maxToken) };
  }
  if (elenco.scopo === 'prenotare') {
    const domanda = componiRicerca(elenco, 'prenotare', elenco.luoghi[0] || elenco.destinazione, elenco.date[0]);
    const trovati = await cerca(env, domanda);
    return { testo: await modello(env, messaggiPerModello(a, conRisultati(trovati)), maxToken), ricerca: trovati.stato };
  }
  /* La chat: decide il modello se gli servono fatti aggiornati. Se si',
     risponde con una riga «CERCA: argomento | luogo | data» invece della
     risposta, e solo allora si cerca e gli si richiede la risposta con i
     risultati davanti. Le domande normali costano una chiamata sola. */
  const primo = await modello(env, messaggiPerModello(a, istruzioneCerca(elenco)), maxToken);
  const chiesta = leggiCerca(primo);
  if (!chiesta) return { testo: primo };
  const domanda = componiRicerca(elenco, chiesta.argomento, chiesta.luogo, chiesta.data);
  const trovati = domanda ? await cerca(env, domanda) : { stato: 'non_riuscita', risultati: [] };
  const secondo = (await modello(env, messaggiPerModello(a, conRisultati(trovati)), maxToken))
    .replace(/^\s*CERCA\s*:.*$/gim, '').trim();
  /* Se insiste a chiedere di cercare invece di rispondere, e' una risposta
     vuota: meglio un errore, che l'app ritenta, che la riga «CERCA» a schermo. */
  if (!secondo) throw new Error('risposta vuota dopo la ricerca');
  return { testo: secondo, ricerca: trovati.stato };
}

function istruzioneCerca(elenco) {
  const luoghi = elenco.luoghi.slice(0, 40).join('; ') || '(nessuno)';
  return 'RICERCA SUL WEB. Se per rispondere ti servono fatti aggiornati che non puoi sapere con certezza ' +
    '(orari di apertura o dei mezzi, aperture o chiusure straordinarie, scioperi, eventi, prezzi di adesso), ' +
    'non rispondere ancora: scrivi soltanto questa riga, e nient\'altro:\n' +
    'CERCA: argomento | luogo | data\n' +
    '- argomento: una sola di queste parole: ' + Object.keys(ARGOMENTI).join(', ') + '\n' +
    '- luogo: uno di questi, copiato identico: ' + luoghi + (elenco.destinazione ? '; oppure la destinazione: ' + elenco.destinazione : '') + '\n' +
    '- data: una di queste nel formato AAAA-MM-GG, oppure lasciala vuota: ' + (elenco.date.slice(0, 40).join(', ') || '(nessuna)') + '\n' +
    'Se non ti servono fatti aggiornati, rispondi normalmente.';
}
function leggiCerca(testo) {
  const m = String(testo || '').match(/^\s*CERCA\s*:\s*([^|\n]*)(?:\|([^|\n]*))?(?:\|([^\n]*))?/im);
  return m ? { argomento: (m[1] || '').trim(), luogo: (m[2] || '').trim(), data: (m[3] || '').trim() } : null;
}
function conRisultati(trovati) {
  if (trovati.stato !== 'fatta' || !trovati.risultati.length) {
    return 'La ricerca sul web non e\' disponibile adesso. Rispondi con quello che sai e, per orari, prezzi e ' +
      'prenotazioni, di\' che non hai potuto controllarli.';
  }
  return 'RISULTATI DI UNA RICERCA SUL WEB, fatta adesso per questa domanda. Usali per i fatti aggiornati; quando ' +
    'dai un orario, un prezzo o una regola di prenotazione di\' da quale sito viene. Se non rispondono alla domanda, dillo.\n' +
    trovati.risultati.map((x, i) => (i + 1) + '. ' + x.titolo + ' (' + x.url + ')\n' + x.testo).join('\n');
}

/* ---- l'elenco di quello che si puo' cercare ---- */
function datiPersonali(s) {
  return /[\w.+-]+@[\w-]+\.[\w.-]+/.test(s)          // email
    || /(?:\+|\b00)\d[\d\s.\-()]{6,}\d/.test(s)      // telefono col prefisso
    || /\d(?:[\s.\-/]?\d){5,}/.test(s)               // sei cifre o piu': telefoni, carte, codici
    || /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,}/.test(s) // IBAN
    || /https?:\/\/|www\./i.test(s);
}
function elencoRicerca(r) {
  const pulito = s => {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    return s && s.length <= 80 && !datiPersonali(s) ? s : '';
  };
  const luoghi = [...new Set((Array.isArray(r.luoghi) ? r.luoghi : []).slice(0, 60).map(pulito).filter(Boolean))];
  const date = [...new Set((Array.isArray(r.date) ? r.date : []).map(d => String(d)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)))].slice(0, 60);
  return { scopo: r.scopo === 'prenotare' ? 'prenotare' : 'chat', luoghi, destinazione: pulito(r.destinazione), date };
}
function normale(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
/* Il luogo proposto vale solo se e' uno di quelli ammessi: se lo contiene
   («Marco alla Torre di Belém»), passa quello ammesso e basta. */
function luogoAmmesso(elenco, proposto) {
  const p = ' ' + normale(proposto) + ' ';
  if (!p.trim()) return '';
  const tutti = elenco.luoghi.concat(elenco.destinazione ? [elenco.destinazione] : []);
  const uguale = tutti.find(x => normale(x) === p.trim());
  if (uguale) return uguale;
  return tutti.filter(x => normale(x) && p.includes(' ' + normale(x) + ' ')).sort((x, y) => y.length - x.length)[0] || '';
}
/* La domanda per Tavily si compone qui, con pezzi presi solo dall'elenco:
   un luogo ammesso, la destinazione, l'argomento tradotto da questo file,
   una data ammessa. Nient'altro puo' entrarci. */
function componiRicerca(elenco, argomento, luogo, data) {
  const arg = ARGOMENTI[normale(argomento)] ? normale(argomento) : 'orari';
  const scelto = luogoAmmesso(elenco, luogo);
  const pezzi = [];
  if (scelto) pezzi.push(scelto);
  const citta = elenco.destinazione;
  if (citta && !normale(scelto).includes(normale(citta.split(',')[0]))) pezzi.push(citta);
  if (!pezzi.length) return '';
  pezzi.push(ARGOMENTI[arg]);
  const d = String(data || '').trim();
  if (elenco.date.includes(d)) pezzi.push(d);
  return pezzi.join(' ').replace(/\s+/g, ' ').trim();
}

/* ---- Tavily ----
   Gli stati che l'app sa dire: fatta, non configurata (manca la chiave, o e'
   sbagliata), crediti finiti, non riuscita. In tutti i casi l'assistente
   risponde lo stesso: la ricerca aiuta, non e' una condizione. */
async function cerca(env, domanda) {
  if (!env.TAVILY_KEY) return { stato: 'non_configurata', risultati: [] };
  let r;
  try {
    r = await fetch(TAVILY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.TAVILY_KEY },
      body: JSON.stringify({ query: domanda, search_depth: 'basic', max_results: 5,
        include_answer: false, include_raw_content: false, include_images: false }),
      /* L'app aspetta al massimo 30 secondi in tutto: una ricerca che non
         risponde non puo' mangiarseli. Dopo 8 si risponde senza. */
      signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
    });
  } catch (e) { return { stato: 'non_riuscita', risultati: [] }; }
  if (r.status === 401 || r.status === 403) return { stato: 'non_configurata', risultati: [] };
  if (r.status === 432 || r.status === 433) return { stato: 'crediti_finiti', risultati: [] };
  if (!r.ok) return { stato: 'non_riuscita', risultati: [] };
  let d = null;
  try { d = await r.json(); } catch (e) { d = null; }
  const risultati = ((d && d.results) || []).slice(0, 5).map(x => ({
    titolo: String(x.title || '').slice(0, 200), url: String(x.url || '').slice(0, 300), testo: String(x.content || '').slice(0, 1000)
  }));
  return { stato: 'fatta', risultati };
}

/* ---- la quota ----
   Sul piano gratuito di Workers AI, finiti i Neuron del giorno, il modello
   risponde con un errore (codice 4006, «daily free allocation»): non con un
   addebito. Torna disponibile a mezzanotte UTC. */
function quotaFinita(e) {
  return /4006|3036|neurons?\b|daily free allocation|allocation (?:exceeded|exhausted)|upgrade to cloudflare'?s workers paid/i
    .test(String((e && e.message) || e));
}
function prossimaMezzanotteUTC(adesso) {
  const d = adesso ? new Date(adesso) : new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)).toISOString();
}

/* ---- /prova: dal browser del telefono, per sapere se va ----
   /prova            una domanda vera al modello, e se la ricerca e' configurata
   /prova?foto=1     in piu' una foto, per sapere se il modello vede
   /prova?ricerca=1  in piu' una ricerca vera su Tavily (consuma un credito) */
async function prova(env, url) {
  const righe = [], nome = env.MODELLO || MODELLO;
  const chiedi = async (titolo, messaggi) => {
    const t0 = Date.now();
    try {
      const r = await env.AI.run(nome, Object.assign({}, opzioniModello(env), { messages: messaggi, max_tokens: 400 }));
      const t = testoDa(r), u = r && r.usage;
      righe.push(t ? titolo + ': FUNZIONA ✅ (' + (Date.now() - t0) + ' ms' +
        (u ? ', token ' + (u.prompt_tokens || '?') + ' in entrata e ' + (u.completion_tokens || '?') + ' in uscita' : '') +
        (haRagionato(r) ? ', ragiona prima di rispondere' : '') + ')\n' + t
        : titolo + ': NON FUNZIONA ❌ risposta vuota' + (tagliata(r) ? ' (tagliata: ha finito i token ragionando, vedi GUIDA-AI)' : ''));
    } catch (e) {
      righe.push(quotaFinita(e) ? titolo + ': quota di oggi finita ⏳ torna alle ' + prossimaMezzanotteUTC().slice(11, 16) + ' UTC'
        : titolo + ': NON FUNZIONA ❌ ' + String((e && e.message) || e).slice(0, 300));
    }
  };
  if (!env.AI || typeof env.AI.run !== 'function') {
    righe.push('ASSISTENTE: NON FUNZIONA ❌ manca il collegamento «AI» del Worker (Impostazioni → Collegamenti → Workers AI, nome AI)');
  } else {
    await chiedi('ASSISTENTE', [{ role: 'user', content: 'Rispondi in italiano con una frase sola: cosa vale la pena vedere a Lisbona?' }]);
    if (url.searchParams.get('foto') === '1') {
      await chiedi('FOTO', [{ role: 'user', content: [
        { type: 'text', text: 'Di che colore è questa immagine? Rispondi con una parola.' },
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + FOTO_DI_PROVA } }] }]);
    }
  }
  righe.push('modello: ' + nome + (env.OPZIONI_MODELLO ? ' con le opzioni ' + env.OPZIONI_MODELLO : ''));
  if (!env.TAVILY_KEY) righe.push('RICERCA WEB: non configurata (manca il secret TAVILY_KEY): l\'assistente risponde senza cercare');
  else if (url.searchParams.get('ricerca') === '1') {
    const c = await cerca(env, 'Torre de Belém Lisboa opening hours');
    righe.push('RICERCA WEB: ' + (c.stato === 'fatta' ? 'FUNZIONA ✅ (' + c.risultati.length + ' risultati)' : 'NON FUNZIONA ❌ ' + c.stato));
  } else righe.push('RICERCA WEB: chiave presente ✅ (per provarla davvero: /prova?ricerca=1, usa un credito)');
  righe.push('ORIGINI AMMESSE: ' + ORIGINI.concat(String(env.ORIGINI || '').split(',').map(x => x.trim()).filter(Boolean)).join(', ') + ' (e localhost per le prove)');
  return testo(righe.join('\n\n'));
}

function json(o, status, headers) {
  return new Response(JSON.stringify(o), { status: status || 200, headers: Object.assign({ 'content-type': 'application/json' }, headers || {}) });
}
function errore(status, tipo, motivo, headers) {
  return json({ error: { type: tipo, message: motivo } }, status, headers);
}
function testo(s) {
  return new Response(s, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
/* Niente altri export: in un Worker gli export con nome sono riservati alle
   classi e agli entrypoint, e un oggetto qualsiasi puo' far rifiutare il
   deploy. La prova (test/prova-ponte-ai.js) passa dal fetch, come l'app. */
