const fs = require('fs'), path = require('path');
const out = 'www';
fs.rmSync(out, { recursive: true, force: true });
for (const d of ['lib', 'engine']) fs.mkdirSync(path.join(out, d), { recursive: true });
fs.mkdirSync(path.join(out, 'assets'), { recursive: true });
if (fs.existsSync('assets/coach.webp')) fs.copyFileSync('assets/coach.webp', path.join(out, 'assets/coach.webp'));
fs.copyFileSync('index.html', path.join(out, 'index.html'));

const walk = d => !fs.existsSync(d) ? [] : fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]);
const die = m => { console.error(m); process.exit(1); };

// chess.js (ESM)
const cf = walk('node_modules/chess.js').filter(f => /chess\.js$/.test(f));
const chess = cf.find(f => f.includes('esm')) || cf[0] || die('No encontre chess.js');
fs.copyFileSync(chess, path.join(out, 'lib/chess.js'));

// Stockfish: copia TODA la carpeta que contiene el motor (js + wasm)
const all = walk('node_modules/stockfish');
const js = all.filter(f => /stockfish[^\/\\]*\.js$/.test(f)).sort((a, b) => (b.includes('src') ? 1 : 0) - (a.includes('src') ? 1 : 0));
if (!js.length) die('No encontre ningun stockfish*.js. Archivos:\n' + all.join('\n'));
const dir = path.dirname(js[0]);
for (const f of fs.readdirSync(dir)) {
  const p = path.join(dir, f);
  if (fs.statSync(p).isFile()) fs.copyFileSync(p, path.join(out, 'engine', f));
}
if (!fs.existsSync(path.join(out, 'engine/stockfish.js'))) fs.copyFileSync(js[0], path.join(out, 'engine/stockfish.js'));
console.log('chess.js:', chess, '\nmotor:', dir, '\n', fs.readdirSync(path.join(out, 'engine')).join(', '));
