// Incluye Stockfish (WASM, 1 hilo) dentro de www/engine para que la app lo use SIN internet.
// Orden de búsqueda:
//   1) vendor/stockfish/  -> archivos .js + .wasm guardados en el propio repositorio (no necesita npm)
//   2) node_modules/stockfish (paquete npm "stockfish")
// Variable STOCKFISH_REQUIRED=1 -> si no se encuentra, el script FALLA (para no generar un APK sin Stockfish).
// Sin esa variable, solo avisa y la app usará el motor propio "Maestro".
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'www', 'engine');
const required = process.env.STOCKFISH_REQUIRED === '1';

function walk(d, acc = []) {
  if (!fs.existsSync(d)) return acc;
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    fs.statSync(p).isDirectory() ? walk(p, acc) : acc.push(p);
  }
  return acc;
}
const isWasm = f => {
  try {
    const fd = fs.openSync(f, 'r'), b = Buffer.alloc(4);
    fs.readSync(fd, b, 0, 4, 0); fs.closeSync(fd);
    return b.equals(Buffer.from([0x00, 0x61, 0x73, 0x6d])) && fs.statSync(f).size > 100 * 1024;
  } catch (e) { return false; }
};

const sources = [path.join(ROOT, 'vendor', 'stockfish'), process.env.STOCKFISH_SRC || path.join(ROOT, 'node_modules', 'stockfish')];
let done = false, seen = [];
for (const src of sources) {
  const all = walk(src); seen = seen.concat(all);
  // Solo loaders de un hilo que corren como Worker (no "no-Worker", no multihilo: necesitan SharedArrayBuffer).
  const isVendor = src === sources[0];
  const js = all.filter(f => f.endsWith('.js') && !/no-?worker/i.test(f) && !/\.min\./i.test(f) &&
    (isVendor || /single/i.test(f)));
  // Preferir "lite" y, a igualdad, el más pequeño.
  js.sort((a, b) => (/lite/i.test(b) - /lite/i.test(a)) || (fs.statSync(a).size - fs.statSync(b).size));
  for (const j of js) {
    const dir = path.dirname(j), base = path.basename(j, '.js');
    // El loader de Stockfish.js busca el .wasm con el MISMO nombre base; si no, cualquier .wasm con prefijo parecido.
    let cands = all.filter(f => path.dirname(f) === dir && f.endsWith('.wasm') && isWasm(f));
    const exact = cands.filter(f => path.basename(f, '.wasm') === base);
    cands = exact.length ? exact : cands.filter(f => path.basename(f).startsWith(base.split(/[-.]/).slice(0, 2).join('-')));
    if (!cands.length) continue;
    fs.mkdirSync(OUT, { recursive: true });
    for (const old of fs.readdirSync(OUT)) if (/^stockfish.*\.(js|wasm)$/i.test(old)) fs.unlinkSync(path.join(OUT, old));
    fs.copyFileSync(j, path.join(OUT, path.basename(j)));
    for (const w of cands) fs.copyFileSync(w, path.join(OUT, path.basename(w)));
    const info = { js: path.basename(j), wasm: cands.map(w => path.basename(w)) };
    fs.writeFileSync(path.join(OUT, 'engine.json'), JSON.stringify(info));
    console.log('Stockfish incluido (offline):', info.js, '+', info.wasm.join(', '),
      '(' + Math.round(cands.reduce((s, w) => s + fs.statSync(w).size, 0) / 1024) + ' KB wasm)');
    done = true; break;
  }
  if (done) break;
}
if (!done) {
  console.log((required ? 'ERROR' : 'AVISO') + ': no se encontró Stockfish de un hilo (.js + .wasm).');
  console.log('Archivos vistos:\n' + (seen.length ? seen.map(f => ' - ' + path.relative(ROOT, f)).join('\n') : ' (ninguno: ¿falló npm install?)'));
  console.log('Solución sin npm: copia el .js y el .wasm de stockfish.js (mismo nombre base) a vendor/stockfish/ y vuelve a compilar.');
  if (required) process.exit(1);
}
