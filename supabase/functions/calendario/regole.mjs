/* IL CALENDARIO CHE SI AGGIORNA: COSA C'E' DENTRO, E COME SI SCRIVE.
 *
 * Il calendario del telefono si iscrive a un indirizzo con un codice dentro
 * (…/functions/v1/calendario/<codice>.ics) e lo riscarica da solo, ogni
 * tanto. Qui si decide cosa diventa un evento e come si scrive il file:
 * iCalendar, RFC 5545.
 *
 * Sta in un file a se' perche' qui non c'e' Deno e la funzione non si puo'
 * lanciare per provarla: cosi' le regole sono UNE, le usa il server e le
 * prova Node (test/prova-pdf-calendario.js), e non possono divergere. Anche
 * `rispondi` e' qui, con la lettura dal database passata da fuori: le prove
 * le danno il Postgres delle prove, il server quello vero.
 *
 * GLI EVENTI. Le tappe con un orario (dentro ci sono gia' i check-in e i
 * check-out degli alberghi e i viaggi dei biglietti messi in un giorno: per
 * l'app sono tappe anche loro); il viaggio di un biglietto senza l'ora, per
 * tutto il giorno; e il check-in o il check-out di un albergo la cui tappa
 * non c'e' piu'. Ogni evento ha un UID fatto dall'id della tappa
 * (o dell'albergo) e del viaggio: una tappa spostata cambia ora, non diventa
 * un evento in piu'; una tappa cancellata sparisce, perche' il file si rifa'
 * ogni volta da capo. Le note delle tappe no: chi ha il link vede
 * l'itinerario, e nelle note uno scrive anche il codice di una prenotazione.
 *
 * IL FUSO. Le ore delle tappe sono «del posto»: le 09:30 a Tokyo sono le
 * 09:30 di Tokyo. Se si sa il fuso del posto (Open-Meteo lo dice col meteo di
 * ogni giorno: weather[data].fuso, o il fuso del viaggio), l'evento si
 * scrive nel suo istante vero, in UTC: il telefono lo mostra nell'ora di
 * dove si trova. A casa, prima di partire, si vede l'ora di casa (e la
 * descrizione dice anche l'ora del posto); in viaggio, col telefono sull'ora
 * di li', si vede 09:30. Gli avvisi suonano al momento giusto. Se il fuso non
 * si sa ancora, l'evento resta «fluttuante», senza fuso, alle 09:30 dovunque:
 * appena il fuso arriva, al giro dopo si corregge da solo.
 */

export const CODICE_RE = /^[0-9a-f]{64}$/;

/* Le poche parole del calendario, nella lingua scelta da chi ha fatto il
   link (la colonna lingua della tabella calendari). I check-in e i
   check-out sono le stesse dell'app. */
const TESTI = {
  it: { nome: 'GeppGo · {1}', descr: 'Il viaggio «{1}» su GeppGo: si aggiorna da solo quando il viaggio cambia.', ora: 'Ora del posto: {1} ({2})', mappa: 'Apri in Google Maps: {1}', dentro: 'Check-in · {1}', fuori: 'Check-out · {1}' },
  en: { nome: 'GeppGo · {1}', descr: 'The trip “{1}” on GeppGo: it updates by itself when the trip changes.', ora: 'Local time: {1} ({2})', mappa: 'Open in Google Maps: {1}', dentro: 'Check-in · {1}', fuori: 'Check-out · {1}' },
  es: { nome: 'GeppGo · {1}', descr: 'El viaje «{1}» en GeppGo: se actualiza solo cuando el viaje cambia.', ora: 'Hora local: {1} ({2})', mappa: 'Abrir en Google Maps: {1}', dentro: 'Entrada · {1}', fuori: 'Salida · {1}' },
  fr: { nome: 'GeppGo · {1}', descr: 'Le voyage « {1} » sur GeppGo : il se met à jour tout seul quand le voyage change.', ora: 'Heure locale : {1} ({2})', mappa: 'Ouvrir dans Google Maps : {1}', dentro: 'Arrivée · {1}', fuori: 'Départ · {1}' },
  pt: { nome: 'GeppGo · {1}', descr: 'A viagem «{1}» no GeppGo: atualiza-se sozinha quando a viagem muda.', ora: 'Hora local: {1} ({2})', mappa: 'Abrir no Google Maps: {1}', dentro: 'Entrada · {1}', fuori: 'Saída · {1}' },
};
function testo(lingua, chiave, ...v) {
  const t = (TESTI[lingua] || TESTI.it)[chiave];
  return t.replace(/\{(\d)\}/g, (_, n) => String(v[n - 1] ?? ''));
}

/* Il codice dall'indirizzo: …/calendario/<codice>.ics, oppure ?c=<codice>. */
export function codiceDallaRichiesta(u) {
  let url;
  try { url = u instanceof URL ? u : new URL(String(u)); } catch (_) { return null; }
  const m = url.pathname.match(/\/([0-9a-f]{64})(?:\.ics)?\/?$/);
  if (m) return m[1];
  const c = url.searchParams.get('c');
  return c && CODICE_RE.test(c) ? c : null;
}

/* ── il fuso ────────────────────────────────────────────────────────────── */
function zonaValida(z) {
  if (!z || typeof z !== 'string') return null;
  try { new Intl.DateTimeFormat('en-US', { timeZone: z }); return z; } catch (_) { return null; }
}
/* Il fuso di un giorno: quello del meteo di quel giorno; se no quello del
   viaggio; se no quello del meteo del giorno piu' vicino. */
export function zonaDelGiorno(viaggio, data) {
  const meteo = (viaggio && viaggio.weather) || {};
  const qui = zonaValida(meteo[data] && meteo[data].fuso);
  if (qui) return qui;
  const delViaggio = zonaValida(viaggio && viaggio.fuso);
  if (delViaggio) return delViaggio;
  const vicini = Object.keys(meteo).filter(d => zonaValida(meteo[d] && meteo[d].fuso))
    .sort((a, b) => Math.abs(Date.parse(a) - Date.parse(data)) - Math.abs(Date.parse(b) - Date.parse(data)));
  return vicini.length ? meteo[vicini[0]].fuso : null;
}
/* Di quanti minuti la zona e' avanti su UTC, in quell'istante. */
function scartoZona(zona, istante) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: zona, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(new Date(istante)).map(x => [x.type, x.value]));
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - istante) / 60000);
}
/* Le 09:30 del 21 ottobre a Tokyo, come istante. Due giri: vicino al cambio
   dell'ora legale lo scarto giusto e' quello dell'istante trovato, non
   quello dell'ora scritta letta come UTC. */
export function utcDaLocale(data, ora, zona) {
  const [Y, M, D] = data.split('-').map(Number), [h, m] = ora.split(':').map(Number);
  const scritta = Date.UTC(Y, M - 1, D, h, m);
  let t = scritta - scartoZona(zona, scritta) * 60000;
  const s2 = scartoZona(zona, t);
  t = scritta - s2 * 60000;
  return new Date(t);
}

/* ── come si scrive ─────────────────────────────────────────────────────── */
const due = n => String(n).padStart(2, '0');
const dataUtc = d => d.getUTCFullYear() + due(d.getUTCMonth() + 1) + due(d.getUTCDate()) + 'T' + due(d.getUTCHours()) + due(d.getUTCMinutes()) + due(d.getUTCSeconds()) + 'Z';
const dataNuda = s => s.replace(/-/g, '');
function piuGiorni(data, n) { const d = new Date(data + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function piuMinuti(data, ora, n) {
  const [h, m] = ora.split(':').map(Number); let tot = h * 60 + m + n, giorni = 0;
  while (tot >= 1440) { tot -= 1440; giorni++; }
  return { data: giorni ? piuGiorni(data, giorni) : data, ora: due(Math.floor(tot / 60)) + ':' + due(tot % 60) };
}
/* Il testo di una proprieta': barre, punti e virgola, virgole e a capo. */
export function scappa(s) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
/* Righe di al massimo 75 byte: le altre continuano sotto, dopo uno spazio.
   Si taglia fra un carattere e l'altro, mai dentro una lettera accentata o
   un ideogramma (che in UTF-8 sono piu' byte). */
export function piega(riga) {
  const pezzi = []; let cur = '', byte = 0, limite = 75;
  for (const ch of riga) {
    const b = new TextEncoder().encode(ch).length;
    if (byte + b > limite) { pezzi.push(cur); cur = ' '; byte = 1; limite = 75; }
    cur += ch; byte += b;
  }
  pezzi.push(cur);
  return pezzi.join('\r\n');
}
const ORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

/* Dove sta una tappa: sua, del posto salvato o dell'albergo a cui e' legata. */
function luogoDi(viaggio, a) {
  const poi = a.poiId != null ? (viaggio.pois || []).find(p => p.id === a.poiId) : null;
  const alb = a.hotelId != null ? (viaggio.hotels || []).find(h => h.id === a.hotelId) : null;
  const lat = a.lat ?? poi?.lat ?? alb?.lat, lng = a.lng ?? poi?.lng ?? alb?.lng;
  const indirizzo = a.address || poi?.address || alb?.address || '';
  return { lat: Number.isFinite(+lat) && lat !== null ? +lat : null, lng: Number.isFinite(+lng) && lng !== null ? +lng : null, indirizzo };
}
export function linkMappa(lat, lng, testoCercato) {
  if (lat != null && lng != null) return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  return testoCercato ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(testoCercato)}` : '';
}
const citta = zona => zona.split('/').pop().replace(/_/g, ' ');

/* Il file intero. `ora` e' l'istante del timbro (DTSTAMP). */
export function calendarioIcs(viaggio, { cid, lingua = 'it', ora = new Date() } = {}) {
  const v = viaggio || {}, L = TESTI[lingua] ? lingua : 'it', dom = String(cid || 'viaggio') + '.geppgo';
  const righe = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GeppGo//Calendario del viaggio//IT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:' + scappa(testo(L, 'nome', v.name || '')), 'X-WR-CALDESC:' + scappa(testo(L, 'descr', v.name || '')),
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
  const timbro = dataUtc(ora);
  const evento = (uid, campi) => { righe.push('BEGIN:VEVENT', 'UID:' + uid, 'DTSTAMP:' + timbro, ...campi, 'END:VEVENT'); };
  const quando = (data, oraIn, dataFine, oraFine, zona) => zona
    ? ['DTSTART:' + dataUtc(utcDaLocale(data, oraIn, zona)), 'DTEND:' + dataUtc(utcDaLocale(dataFine, oraFine, zona))]
    : ['DTSTART:' + dataNuda(data) + 'T' + oraIn.replace(':', '') + '00', 'DTEND:' + dataNuda(dataFine) + 'T' + oraFine.replace(':', '') + '00'];
  const coperti = new Set();
  const diBiglietti = new Set((v.tickets || []).map(k => k && k.actId).filter(x => x != null));
  for (const d of v.days || []) {
    if (!d || !DATA_RE.test(d.date || '')) continue;
    const zona = zonaDelGiorno(v, d.date);
    for (const a of d.activities || []) {
      if (!a) continue;
      /* Il viaggio di un biglietto messo in un giorno senza l'ora: un evento
         di tutto il giorno, perche' un volo non deve sparire dal calendario
         solo perche' l'ora non e' ancora scritta. */
      if (!ORA_RE.test(a.time || '')) {
        if (diBiglietti.has(a.id)) evento('tappa-' + a.id + '@' + dom, ['DTSTART;VALUE=DATE:' + dataNuda(d.date), 'DTEND;VALUE=DATE:' + dataNuda(piuGiorni(d.date, 1)), 'SUMMARY:' + scappa(a.name || '')]);
        continue;
      }
      if (a.hotelId != null) coperti.add(a.hotelId + '|' + d.date);
      let fine;
      if (a.nextDay && ORA_RE.test(a.timeEnd || '')) fine = { data: piuGiorni(d.date, 1), ora: a.timeEnd };
      else if (ORA_RE.test(a.timeEnd || '') && a.timeEnd > a.time) fine = { data: d.date, ora: a.timeEnd };
      else fine = piuMinuti(d.date, a.time, 60);
      const { lat, lng, indirizzo } = luogoDi(v, a);
      const link = linkMappa(lat, lng, indirizzo);
      const descr = [];
      if (zona) descr.push(testo(L, 'ora', a.time + (fine.data === d.date ? '–' + fine.ora : ''), citta(zona)));
      if (indirizzo) descr.push(indirizzo);
      if (link) descr.push(testo(L, 'mappa', link));
      const campi = [...quando(d.date, a.time, fine.data, fine.ora, zona), 'SUMMARY:' + scappa(a.name || '')];
      if (indirizzo) campi.push('LOCATION:' + scappa(indirizzo));
      if (lat != null && lng != null) campi.push('GEO:' + lat + ';' + lng);
      if (link) campi.push('URL:' + link);
      if (descr.length) campi.push('DESCRIPTION:' + scappa(descr.join('\n')));
      if (+a.remindMin > 0) campi.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + scappa(a.name || ''), 'TRIGGER:-PT' + Math.round(+a.remindMin) + 'M', 'END:VALARM');
      evento('tappa-' + a.id + '@' + dom, campi);
    }
  }
  /* Gli alberghi la cui tappa del check-in (o del check-out) non c'e' piu':
     all'ora scritta nella prenotazione, o per tutto il giorno se non c'e'. */
  for (const h of v.hotels || []) {
    if (!h) continue;
    for (const [tipo, data, oraH] of [['dentro', h.checkIn, h.oraCheckIn], ['fuori', h.checkOut, h.oraCheckOut]]) {
      if (!DATA_RE.test(data || '') || coperti.has(h.id + '|' + data)) continue;
      const zona = zonaDelGiorno(v, data), link = linkMappa(h.lat ?? null, h.lng ?? null, h.address || h.name);
      const campi = ORA_RE.test(oraH || '')
        ? quando(data, oraH, piuMinuti(data, oraH, 30).data, piuMinuti(data, oraH, 30).ora, zona)
        : ['DTSTART;VALUE=DATE:' + dataNuda(data), 'DTEND;VALUE=DATE:' + dataNuda(piuGiorni(data, 1))];
      campi.push('SUMMARY:' + scappa(testo(L, tipo, h.name || '')));
      if (h.address) campi.push('LOCATION:' + scappa(h.address));
      if (link) campi.push('URL:' + link, 'DESCRIPTION:' + scappa([h.address, testo(L, 'mappa', link)].filter(Boolean).join('\n')));
      evento((tipo === 'dentro' ? 'checkin-' : 'checkout-') + h.id + '@' + dom, campi);
    }
  }
  righe.push('END:VCALENDAR');
  return righe.map(piega).join('\r\n') + '\r\n';
}

/* La risposta della funzione, per un indirizzo. `leggi(codice)` torna il
   viaggio di quel codice ({trip_id, lingua, data}) o niente: il codice
   sbagliato, spento o di chi e' uscito dal viaggio rispondono tutti e tre
   «non c'e'», senza dire quale. */
export async function rispondi(url, { leggi, ora = new Date() }) {
  const codice = codiceDallaRichiesta(url);
  if (!codice) return { stato: 404, corpo: 'Calendario non trovato\n' };
  let riga;
  try { riga = await leggi(codice); }
  catch (_) { return { stato: 503, corpo: 'Il calendario non risponde: riprova più tardi\n' }; }
  if (!riga || !riga.data) return { stato: 404, corpo: 'Calendario non trovato\n' };
  return { stato: 200, tipo: 'text/calendar; charset=utf-8', corpo: calendarioIcs(riga.data, { cid: riga.trip_id, lingua: riga.lingua, ora }) };
}
