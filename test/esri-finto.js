/* ESRI FINTO: le risposte di Esri simulate, per le prove delle mappe.
 *
 * PERCHE'. La chiave di Esri vale solo dal sito pubblicato
 * (https://87jg2gk7tn-bit.github.io): da qui, e dal server delle prove, Esri
 * la rifiuterebbe. E una prova non deve parlare col servizio vero comunque
 * (vedi il recinto in browser.js): qui le mappe rispondono come Esri, con lo
 * stile fatto come quello vero (sorgenti, attribuzioni, caratteri, simboli:
 * la forma e' quella delle risposte che usa il plugin di Esri per MapLibre
 * nelle sue prove), e si contano le richieste.
 *
 *   const esri = await esriFinto(page);            // Esri risponde
 *   const esri = await esriFinto(page, { giu: true });      // non risponde (rete)
 *   const esri = await esriFinto(page, { rifiuta: true });  // chiave rifiutata (498)
 *   esri.conta  -> { stile, pezzi, vettori, caratteri, simboli, osm, senzaChiave }
 *   esri.pezzi  -> gli indirizzi dei pezzi della foto chiesti
 *
 * I pezzi della foto sono un PNG da 256 px (a scacchi, perche' una foto di
 * prova si riconosca), con Cache-Control: max-age come quelli veri; quelli
 * delle strade sono pezzi vettoriali vuoti, che MapLibre accetta. */
const zlib = require('zlib');

const STILE = 'basemapstyles-api.arcgis.com';
const FOTO = 'ibasemaps-api.arcgis.com';
const VETTORI = 'basemaps-api.arcgis.com';
const SIMBOLI = 'cdn.arcgis.com';
const OSM = 'tile.openstreetmap.org';
const ATTRIBUZIONE_FOTO = 'Esri, Vantor, Earthstar Geographics, and the GIS User Community';
const ATTRIBUZIONE_STRADE = 'Esri, TomTom, Garmin, FAO, NOAA, USGS, © OpenStreetMap contributors, and the GIS User Community';

function stileFinto() {
  return {
    version: 8,
    glyphs: 'https://' + VETTORI + '/arcgis/rest/services/World_Basemap_v2/VectorTileServer/resources/fonts/{fontstack}/{range}.pbf',
    sprite: 'https://' + SIMBOLI + '/sharing/rest/content/items/30d6b8271e1849cd9c3042060001f425/resources/styles/../sprites/sprite',
    sources: {
      World_Imagery: { type: 'raster', tiles: ['https://' + FOTO + '/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19, attribution: ATTRIBUZIONE_FOTO },
      esri: { type: 'vector', url: 'https://' + VETTORI + '/arcgis/rest/services/World_Basemap_v2/VectorTileServer',
        tiles: ['https://' + VETTORI + '/arcgis/rest/services/World_Basemap_v2/VectorTileServer/tile/{z}/{y}/{x}.pbf'],
        minzoom: '0', maxzoom: '16', attribution: ATTRIBUZIONE_STRADE, copyrightText: ATTRIBUZIONE_STRADE }
    },
    layers: [
      { id: 'World_Imagery', type: 'raster', source: 'World_Imagery' },
      { id: 'Road/Major', type: 'line', source: 'esri', 'source-layer': 'Road', minzoom: 5, paint: { 'line-color': '#FFF7D6', 'line-width': 1.2 } },
      { id: 'Road/label/Major', type: 'symbol', source: 'esri', 'source-layer': 'Road/label', layout: { 'text-field': '{_name}', 'text-font': ['Arial Regular'], 'text-size': 12 }, paint: { 'text-color': '#FFFFFF', 'text-halo-color': '#000000', 'text-halo-width': 1 } },
      { id: 'Admin0 point/label', type: 'symbol', source: 'esri', 'source-layer': 'Admin0 point', maxzoom: 6, layout: { 'text-field': '{_name}', 'text-font': ['Arial Regular'] }, paint: { 'text-color': '#FFFFFF' } }
    ]
  };
}

/* Un PNG vero, fatto a mano (zlib): a scacchi di due colori. */
function crc32(buf) {
  let c, crc = 0xFFFFFFFF;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xFF;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function pezzo(tipo, dati) {
  const lun = Buffer.alloc(4); lun.writeUInt32BE(dati.length);
  const td = Buffer.concat([Buffer.from(tipo, 'ascii'), dati]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td));
  return Buffer.concat([lun, td, c]);
}
function pngScacchi(lato, a, b) {
  const righe = [];
  for (let y = 0; y < lato; y++) {
    const r = Buffer.alloc(1 + lato * 3);
    for (let x = 0; x < lato; x++) {
      const col = ((x >> 5) + (y >> 5)) % 2 ? a : b;
      r[1 + x * 3] = col[0]; r[2 + x * 3] = col[1]; r[3 + x * 3] = col[2];
    }
    righe.push(r);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lato, 0); ihdr.writeUInt32BE(lato, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pezzo('IHDR', ihdr), pezzo('IDAT', zlib.deflateSync(Buffer.concat(righe))), pezzo('IEND', Buffer.alloc(0))]);
}
const PNG_FOTO = pngScacchi(256, [92, 110, 84], [150, 160, 130]);
const PNG_OSM = pngScacchi(256, [242, 239, 233], [214, 230, 200]);
const PNG_PUNTO = pngScacchi(1, [0, 0, 0], [0, 0, 0]);

async function esriFinto(page, opz = {}) {
  const conta = { stile: 0, pezzi: 0, vettori: 0, caratteri: 0, simboli: 0, osm: 0, senzaChiave: 0, descrizione: 0 };
  const pezzi = [];
  const comune = { 'access-control-allow-origin': '*', 'cache-control': opz.cacheControl || 'max-age=86400' };
  const chiaveDi = u => u.searchParams.get('token');
  await page.route(u => [STILE, FOTO, VETTORI, SIMBOLI, OSM].includes(u.hostname), async route => {
    const u = new URL(route.request().url());
    if (u.hostname === OSM) {
      conta.osm++;
      if (opz.osmGiu) return route.abort('internetdisconnected');
      return route.fulfill({ status: 200, contentType: 'image/png', headers: comune, body: PNG_OSM });
    }
    if (opz.giu) return route.abort('internetdisconnected');
    if (!chiaveDi(u)) conta.senzaChiave++;
    if (u.hostname === STILE) {
      conta.stile++;
      if (opz.rifiuta) return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ error: { code: 498, message: 'Invalid token.', details: [] } }) });
      if (opz.lento) await new Promise(r => setTimeout(r, opz.lento));
      return route.fulfill({ status: 200, contentType: 'application/json', headers: comune, body: JSON.stringify(stileFinto()) });
    }
    if (opz.rifiutaPezzi) return route.fulfill({ status: 498, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: 'Invalid token.' });
    if (u.hostname === FOTO) {
      conta.pezzi++; pezzi.push(u.pathname);
      return route.fulfill({ status: 200, contentType: 'image/png', headers: comune, body: PNG_FOTO });
    }
    if (u.hostname === VETTORI) {
      if (/\/resources\/fonts\//.test(u.pathname)) { conta.caratteri++; return route.fulfill({ status: 200, contentType: 'application/x-protobuf', headers: comune, body: Buffer.alloc(0) }); }
      if (/\/tile\//.test(u.pathname)) { conta.vettori++; return route.fulfill({ status: 200, contentType: 'application/x-protobuf', headers: comune, body: Buffer.alloc(0) }); }
      conta.descrizione++;
      return route.fulfill({ status: 200, contentType: 'application/json', headers: comune, body: JSON.stringify({ tiles: stileFinto().sources.esri.tiles, minzoom: 0, maxzoom: 16 }) });
    }
    if (u.hostname === SIMBOLI) {
      conta.simboli++;
      if (/\.json$/.test(u.pathname)) return route.fulfill({ status: 200, contentType: 'application/json', headers: comune, body: '{}' });
      return route.fulfill({ status: 200, contentType: 'image/png', headers: comune, body: PNG_PUNTO });
    }
    return route.abort('blockedbyclient');
  });
  return { conta, pezzi, ATTRIBUZIONE_FOTO, ATTRIBUZIONE_STRADE };
}

/* La chiave come sta scritta nell'app: le prove la leggono da li', cosi' nel
   repo resta scritta in un posto solo. */
function chiaveDellApp(html) {
  const m = /const ESRI_CHIAVE='([^']+)'/.exec(html);
  return m ? m[1] : null;
}

module.exports = { esriFinto, stileFinto, chiaveDellApp, PNG_FOTO, ATTRIBUZIONE_FOTO, ATTRIBUZIONE_STRADE, HOST_ESRI: [STILE, FOTO, VETTORI, SIMBOLI] };
