const fs = require('fs');
const path = require('path');
const engineDir = path.join(__dirname, '..', 'www', 'engine');
const maestro = path.join(engineDir, 'maestro-engine.js');
const manifest = path.join(engineDir, 'engine.json');

if (!fs.existsSync(manifest)) throw new Error('Falta www/engine/engine.json');
const cfg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
if (!cfg.js || !Array.isArray(cfg.wasm) || !cfg.wasm.length) throw new Error('Manifest Stockfish incompleto');
for (const name of [cfg.js, ...cfg.wasm]) {
  const file = path.join(engineDir, name);
  if (!fs.existsSync(file)) throw new Error('Falta archivo del motor: ' + name);
}
console.log('Stockfish offline: archivos JS/WASM presentes y verificados.');

if (!fs.existsSync(maestro)) {
  console.log('Maestro separado no está incluido en esta variante; la interfaz usa su motor de respaldo integrado.');
  process.exit(0);
}

const { Pos, perft } = require(maestro);
const tests = [
  ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 4, 197281],
  ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 3, 97862],
  ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', 5, 674624],
  ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', 4, 422333]
];
for (const [fen, depth, expected] of tests) {
  const actual = perft(new Pos(fen), depth);
  console.log(actual === expected ? 'OK' : 'FAIL', actual, expected);
  if (actual !== expected) process.exitCode = 1;
}
if (process.exitCode) process.exit(1);
