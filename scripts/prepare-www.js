// Copia index.html, chess.js y stockfish a www/ para Capacitor
const fs = require('fs'), path = require('path');
const out = 'www';
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'lib'), { recursive: true });
fs.mkdirSync(path.join(out, 'engine'), { recursive: true });
fs.copyFileSync('index.html', path.join(out, 'index.html'));

function first(cands, label) {
  const f = cands.find(p => fs.existsSync(p));
  if (!f) { console.error('No encontré ' + label + '. Probé:\n' + cands.join('\n')); process.exit(1); }
  return f;
}
const chess = first([
  'node_modules/chess.js/dist/esm/chess.js',
  'node_modules/chess.js/dist/chess.js'
], 'chess.js');
fs.copyFileSync(chess, path.join(out, 'lib/chess.js'));

const sf = first([
  'node_modules/stockfish/src/stockfish.js',
  'node_modules/stockfish/stockfish.js',
  'node_modules/stockfish/src/stockfish-nnue-16-single.js'
], 'stockfish');
fs.copyFileSync(sf, path.join(out, 'engine/stockfish.js'));
console.log('www listo:', chess, sf);
