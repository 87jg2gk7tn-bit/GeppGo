/* Un finto Overpass che capisce davvero la domanda.
 *
 * PERCHE' ESISTE. Il finto di prima guardava la domanda con due espressioni
 * regolari e rispondeva "sì" se UNO qualunque dei filtri combaciava. Overpass
 * non funziona così: dentro una stessa parentesi i filtri si sommano —
 * `node["public_transport"="platform"]["bus"="yes"]` vuole tutti e due — e
 * conosce anche la presenza di una chiave (`["atm"]`) e la negazione
 * (`["atm"!="no"]`), che il finto ignorava del tutto.
 *
 * Il costo di quella differenza non è teorico: una prova sul filtro che
 * esclude `atm=no` sarebbe passata identica sul codice rotto, perché il
 * finto non sapeva cosa fosse una negazione. Una prova che non sa leggere
 * la domanda non sta provando la domanda.
 *
 * Qui la domanda si legge per davvero: si spezza in enunciati, e ogni
 * enunciato è tipo + raggio + TUTTI i suoi filtri, che devono valere
 * insieme. */

/* Un filtro alla volta, nelle forme che Overpass accetta e che l'app usa. */
function unFiltro(corpo, tags) {
  let m;
  /* [~"^(name|brand)$"~"parole",i] — espressione regolare anche sul NOME
     della chiave: è così che si guardano cinque campi in un colpo solo. */
  if ((m = /^~"([^"]*)"\s*~\s*"([^"]*)"(,i)?$/.exec(corpo))) {
    const kRe = new RegExp(m[1]), vRe = new RegExp(m[2], m[3] ? 'i' : '');
    return Object.entries(tags).some(([k, v]) => kRe.test(k) && vRe.test(v));
  }
  // ["k"!~"pattern",i] — la chiave NON deve somigliare a questo
  if ((m = /^"([^"]+)"\s*!~\s*"([^"]*)"(,i)?$/.exec(corpo))) {
    const v = tags[m[1]];
    return v == null || !new RegExp(m[2], m[3] ? 'i' : '').test(v);
  }
  // ["k"~"pattern",i]
  if ((m = /^"([^"]+)"\s*~\s*"([^"]*)"(,i)?$/.exec(corpo))) {
    const v = tags[m[1]];
    return v != null && new RegExp(m[2], m[3] ? 'i' : '').test(v);
  }
  /* ["k"!="v"] — in Overpass è vero anche quando la chiave non c'è
     affatto: "non è no" vale per chi non dice niente. */
  if ((m = /^"([^"]+)"\s*!=\s*"([^"]*)"$/.exec(corpo))) return tags[m[1]] !== m[2];
  // ["k"="v"]
  if ((m = /^"([^"]+)"\s*=\s*"([^"]*)"$/.exec(corpo))) return tags[m[1]] === m[2];
  // ["k"] — basta che la chiave ci sia, qualunque valore abbia
  if ((m = /^"([^"]+)"$/.exec(corpo))) return tags[m[1]] != null;
  /* Una forma che non si sa leggere non deve passare in silenzio: se un
     giorno l'app ne usa una nuova, la prova lo deve dire invece di
     rispondere a caso. */
  throw new Error('filtro Overpass che non so leggere: [' + corpo + ']');
}

function metri(aLat, aLng, bLat, bLng) {
  const R = 6371000, dLa = (bLat - aLat) * Math.PI / 180, dLo = (bLng - aLng) * Math.PI / 180;
  const x = Math.sin(dLa / 2) ** 2 +
    Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLo / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/* Gli enunciati della domanda: `node["a"="b"]["c"="d"](around:500,lat,lng);`
   Non si legge con un'espressione regolare, e il motivo e' concreto: dentro
   un filtro ci possono essere parentesi quadre, perche' i filtri contengono
   espressioni regolari — `ban[ckq]` cerca banca, bank, banq. Una regola che
   si ferma alla prima `]` taglia il filtro a meta' e non riconosce piu'
   niente. Si scorre la domanda a mano, tenendo il conto delle virgolette. */
function enunciati(q) {
  const fuori = [];
  /* `nwr` vuol dire tutti e tre insieme: l'app la usa per non chiedere la
     stessa cosa tre volte, e il finto la deve capire. */
  const tipi = /(nwr|node|way|relation)/g;
  let m;
  while ((m = tipi.exec(q))) {
    let i = m.index + m[1].length;
    /* dev'essere l'inizio di una parola: "node" dentro "nodes" non conta */
    if (m.index > 0 && /[A-Za-z_]/.test(q[m.index - 1])) continue;
    if (q[i] !== '[') continue;
    const filtri = [];
    while (q[i] === '[') {
      let j = i + 1, dentroVirgolette = false;
      while (j < q.length) {
        const c = q[j];
        if (c === '"' && q[j - 1] !== '\\') dentroVirgolette = !dentroVirgolette;
        else if (c === ']' && !dentroVirgolette) break;
        j++;
      }
      if (j >= q.length) break;
      filtri.push(q.slice(i + 1, j));
      i = j + 1;
    }
    const around = /^\(around:(\d+),\s*([-\d.]+),\s*([-\d.]+)\)\s*;/.exec(q.slice(i));
    if (!around) continue;
    fuori.push({ tipo: m[1], filtri, raggio: +around[1], lat: +around[2], lng: +around[3] });
    tipi.lastIndex = i + around[0].length;
  }
  return fuori;
}

/* Quello che Overpass risponderebbe a questa domanda, dato un mondo. */
function rispondi(q, elementi) {
  const parti = enunciati(q);
  if (!parti.length) throw new Error('domanda Overpass senza nessun "around": ' + q.slice(0, 120));
  return elementi.filter(el => {
    const la = el.lat != null ? el.lat : (el.center && el.center.lat);
    const lo = el.lon != null ? el.lon : (el.center && el.center.lon);
    const tags = el.tags || {};
    return parti.some(p =>
      (p.tipo === 'nwr' || p.tipo === el.type) &&
      metri(p.lat, p.lng, la, lo) <= p.raggio &&
      p.filtri.every(c => unFiltro(c, tags)));
  });
}

module.exports = { rispondi, enunciati, unFiltro, metri };
