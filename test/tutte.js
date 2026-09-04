#!/usr/bin/env node
/* Lancia tutte le prove di GeppGo e dice come è andata.
 *
 * Prima ogni prova si lanciava a mano, una per volta, ricordandosi quali
 * esistevano. Funziona finché c'è qualcuno che se le ricorda tutte — cioè
 * finché non ci si dimentica, che è il momento in cui una prova serviva.
 *
 *   npm test              tutte
 *   npm run test:app      solo quelle sull'app (servono Node e Chromium)
 *   npm run test:db       solo quelle sul database (serve Postgres)
 *
 * Le prove sul database vogliono un Postgres. Si dice dove sta con le
 * variabili di sempre (PGHOST, PGPORT, PGUSER, PGDATABASE): se non risponde,
 * quelle prove vengono saltate e detto chiaramente, invece di far finta che
 * sia andato tutto bene.
 *
 * Su una macchina di sviluppo saltare va bene. Sui server delle prove
 * automatiche no: li' un Postgres configurato male passerebbe verde senza che
 * i permessi siano mai stati controllati, che e' peggio di una prova rossa
 * perche' non lo si viene a sapere. Percio' li' si mette PROVE_TUTTE=1, e una
 * prova saltata conta come una prova andata male.
 */
const pretendiTutte = !!process.env.PROVE_TUTTE;
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const QUI = __dirname;
const soloApp = process.argv.includes('--solo-app');
const soloDb  = process.argv.includes('--solo-db');

const V = '\x1b[32m', R = '\x1b[31m', G = '\x1b[90m', B = '\x1b[1m', Z = '\x1b[0m';
const esiti = [];

function titolo(t) { console.log(`\n${B}${t}${Z}`); }

/* Ogni prova stampa in fondo "N/M passati": è l'unica cosa che serve leggere
   da fuori. Se non c'è, qualcosa è andato storto prima di arrivare in fondo. */
function conta(uscita) {
  const m = /(\d+)\/(\d+) passati/.exec(uscita);
  return m ? { passate: +m[1], tutte: +m[2] } : null;
}

function riga(nome, esito, nota) {
  if (esito === 'saltata' && pretendiTutte) {
    esito = 'male';
    nota += ' — e qui non si puo\' saltare (PROVE_TUTTE)';
  }
  const segno = esito === 'ok' ? `${V}✓${Z}` : esito === 'saltata' ? `${G}–${Z}` : `${R}✗${Z}`;
  console.log(`  ${segno} ${nome.padEnd(26)} ${nota}`);
  esiti.push({ nome, esito });
}

// ── le prove sull'app ───────────────────────────────────────────────────────
function proveApp() {
  titolo("Le prove sull'app");
  const file = fs.readdirSync(QUI)
    .filter(f => /^prova-.*\.js$/.test(f))
    .sort();
  for (const f of file) {
    const nome = f.replace(/^prova-|\.js$/g, '');
    const res = spawnSync(process.execPath, [path.join(QUI, f)], {
      encoding: 'utf8', timeout: 15 * 60 * 1000,
      env: Object.assign({}, process.env)
    });
    const uscita = (res.stdout || '') + (res.stderr || '');
    const c = conta(uscita);
    if (res.status === 0 && c) riga(nome, 'ok', `${c.passate}/${c.tutte}`);
    else {
      const falliti = uscita.split('\n').filter(l => l.includes('FALLITO'));
      riga(nome, 'male', c ? `${c.passate}/${c.tutte}` : 'non è arrivata in fondo');
      const dettaglio = falliti.length ? falliti : uscita.trim().split('\n').slice(-6);
      dettaglio.slice(0, 8).forEach(l => console.log(`      ${G}${l.trim()}${Z}`));
    }
  }
}

// ── le prove sul database ───────────────────────────────────────────────────
function psql(args, opz = {}) {
  return spawnSync('psql', ['-v', 'ON_ERROR_STOP=1', '-q'].concat(args),
    Object.assign({ encoding: 'utf8' }, opz));
}

function postgresRisponde() {
  const r = spawnSync('psql', ['-tAc', 'select 1'], { encoding: 'utf8' });
  return r.status === 0 && /1/.test(r.stdout || '');
}

function proveDb() {
  titolo('Le prove sul database');

  if (spawnSync('psql', ['--version'], { encoding: 'utf8' }).status !== 0) {
    riga('(tutte)', 'saltata', 'psql non è installato');
    return;
  }
  if (!postgresRisponde()) {
    riga('(tutte)', 'saltata',
      `Postgres non risponde su ${process.env.PGHOST || 'host di sistema'}:${process.env.PGPORT || 5432}`);
    return;
  }

  /* Si riparte sempre da vuoto: una prova che eredita lo stato di quella
     prima non dice niente di affidabile. */
  const prep = psql(['-c', 'drop schema if exists storage cascade; drop schema public cascade; ' +
                           'create schema public; grant usage on schema public to anon, authenticated;']);
  if (prep.status !== 0) {
    // I ruoli anon/authenticated non ci sono ancora al primo giro: si crea
    // l'ambiente finto e si riprova.
    psql(['-c', 'drop schema if exists storage cascade; drop schema public cascade; create schema public;']);
  }
  const amb = psql(['-f', path.join(QUI, 'supabase-ambiente-finto.sql')]);
  if (amb.status !== 0) {
    riga('(tutte)', 'male', 'non riesco a preparare il finto Supabase');
    console.log(`      ${G}${(amb.stderr || '').trim().split('\n').slice(0, 4).join('\n      ')}${Z}`);
    return;
  }
  psql(['-c', 'grant usage on schema public to anon, authenticated;']);

  const schema = psql(['-f', path.join(QUI, '..', 'supabase-schema.sql')]);
  if (schema.status !== 0) {
    riga('schema', 'male', 'lo schema non si applica');
    console.log(`      ${G}${(schema.stderr || '').trim().split('\n').slice(0, 6).join('\n      ')}${Z}`);
    return;
  }
  riga('schema', 'ok', 'si applica su un database vuoto');

  const file = fs.readdirSync(QUI).filter(f => /^supabase-prova-.*\.sql$/.test(f)).sort();
  for (const f of file) {
    const nome = f.replace(/^supabase-prova-|\.sql$/g, '');
    const res = spawnSync('psql', ['-q', '-f', path.join(QUI, f)], { encoding: 'utf8' });
    const uscita = (res.stdout || '') + (res.stderr || '');
    const c = conta(uscita);
    const falliti = uscita.split('\n').filter(l => l.includes('FALLITO'));
    if (c && falliti.length === 0) riga(nome, 'ok', `${c.passate}/${c.tutte}`);
    else {
      riga(nome, 'male', c ? `${c.passate}/${c.tutte}` : 'non è arrivata in fondo');
      (falliti.length ? falliti : uscita.trim().split('\n').slice(-5))
        .slice(0, 8).forEach(l => console.log(`      ${G}${l.trim()}${Z}`));
    }
  }

  /* Lo schema non serve solo su un database vuoto: deve posarsi su quello
     vero, che ha già dei dati e magari dei permessi vecchi sotto. È il caso
     che ha già fatto trovare due guasti seri, quindi si prova sempre. */
  titolo('E lo schema sul database vero, non solo su uno vuoto');
  psql(['-c', 'drop schema if exists storage cascade; drop schema public cascade; create schema public;']);
  psql(['-f', path.join(QUI, 'supabase-ambiente-finto.sql')]);
  psql(['-c', 'grant usage on schema public to anon, authenticated;']);
  const comEra = psql(['-f', path.join(QUI, 'supabase-com-era.sql')]);
  if (comEra.status !== 0) { riga('aggiornamento', 'saltata', 'non riesco a ricostruire il database di prima'); return; }
  const sopra = psql(['-f', path.join(QUI, '..', 'supabase-schema.sql')]);
  if (sopra.status !== 0) {
    riga('aggiornamento', 'male', 'lo schema non si posa sul database di prima');
    console.log(`      ${G}${(sopra.stderr || '').trim().split('\n').slice(0, 6).join('\n      ')}${Z}`);
    return;
  }
  let tutteBene = true;
  for (const f of file) {
    const res = spawnSync('psql', ['-q', '-f', path.join(QUI, f)], { encoding: 'utf8' });
    const uscita = (res.stdout || '') + (res.stderr || '');
    if (!conta(uscita) || uscita.includes('FALLITO')) {
      tutteBene = false;
      riga(f.replace(/^supabase-prova-|\.sql$/g, '') + ' (aggiornato)', 'male',
        (conta(uscita) || { passate: '?', tutte: '?' }).passate + '/' + (conta(uscita) || {}).tutte);
    }
  }
  if (tutteBene) riga('aggiornamento', 'ok', 'si posa sul database vero, e regge');
}

// ── e la sintassi dell'app, che è la prova più veloce che ci sia ────────────
function proveSintassi() {
  titolo("La sintassi dell'app");
  const file = path.join(QUI, '..', 'Index 2.1.html');
  const html = fs.readFileSync(file, 'utf8');
  const blocchi = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)];
  let rotti = 0;
  blocchi.forEach((b, i) => {
    try { new Function(b[1]); }
    catch (e) { rotti++; console.log(`      ${G}blocco ${i}: ${e.message}${Z}`); }
  });
  riga('Index 2.1.html', rotti ? 'male' : 'ok',
    rotti ? `${rotti} blocchi con errori` : `${blocchi.length} blocchi, nessun errore`);
}

// ── via ─────────────────────────────────────────────────────────────────────
proveSintassi();
if (!soloDb) proveApp();
if (!soloApp) proveDb();

const male = esiti.filter(e => e.esito === 'male');
const saltate = esiti.filter(e => e.esito === 'saltata');
console.log('');
if (male.length) {
  console.log(`${R}${B}${male.length} prove con qualcosa che non va:${Z} ${male.map(e => e.nome).join(', ')}`);
  process.exit(1);
}
console.log(`${V}${B}Tutto a posto${Z} — ${esiti.length - saltate.length} prove passate` +
  (saltate.length ? `, ${saltate.length} saltate` : ''));
