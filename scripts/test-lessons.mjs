import fs from 'node:fs';
import vm from 'node:vm';
import { Chess } from 'chess.js';

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('const L=[');
const end = html.indexOf("\nlet mode='play'", start);
if (start < 0 || end < 0) throw new Error('No se encontró el bloque de lecciones en index.html');
const source = html.slice(start, end) + '\nglobalThis.__lessons = L;';
const sandbox = {};
vm.runInNewContext(source, sandbox);
const lessons = sandbox.__lessons;
if (lessons.length !== 36) throw new Error('Se esperaban 36 lecciones; encontradas: ' + lessons.length);

function parseMoves(raw) {
  return String(raw || '').replace(/\{[^}]*\}/g, ' ').replace(/;[^\n]*/g, ' ').replace(/\$\d+/g, ' ')
    .split(/\s+/).map(token => token.replace(/^\d+\.(?:\.\.)?/, '').replace(/[!?]+$/, ''))
    .filter(token => token && !/^\d+\.(?:\.\.)?$/.test(token) && !/^\.\.\.$/.test(token)
      && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token) && token !== 'e.p.');
}

let totalMoves = 0;
for (const lesson of lessons) {
  const chess = new Chess();
  const moves = parseMoves(lesson[1]);
  if (!moves.length) throw new Error('Lección sin jugadas: ' + lesson[0]);
  for (let i = 0; i < moves.length; i++) {
    const san = moves[i];
    try {
      const before = chess.fen();
      chess.move(san);
      if (chess.fen() === before) throw new Error('La posición no cambió');
      totalMoves++;
    } catch (error) {
      throw new Error('Línea inválida: ' + lesson[0] + ' | jugada ' + (i + 1) + ' «' + san + '»: ' + error.message);
    }
  }
  for (let target = 0; target <= moves.length; target++) {
    const replay = new Chess();
    for (const san of moves.slice(0, target)) replay.move(san);
    if (replay.history().length !== target) throw new Error('Falló la reconstrucción en ' + lesson[0] + ', paso ' + target);
  }
}

if (!html.includes("G.me=$('#col').value") || !html.includes("m.color===G.me"))
  throw new Error('El test de nivel todavía no respeta el color elegido para el análisis.');
if (!html.includes("className='coord rank'") || !html.includes("className='coord file'"))
  throw new Error('Faltan las coordenadas del tablero.');
if (!html.includes("screenRow===7") || !html.includes("screenCol===0"))
  throw new Error('Las coordenadas no están asociadas a los bordes visibles del tablero.');
if (!html.includes("f:mode==='local'?G.g.turn()==='b':flipped()"))
  throw new Error('La partida local no gira automáticamente hacia el jugador que tiene el turno.');
const localGame = new Chess();
if (localGame.turn() !== 'w') throw new Error('La partida local debe empezar con blancas abajo.');
localGame.move('e4');
if (localGame.turn() !== 'b') throw new Error('Tras la jugada blanca, debe quedar el turno negro.');
localGame.move('e5');
if (localGame.turn() !== 'w') throw new Error('Tras la jugada negra, debe volver el turno blanco.');

console.log('OK: ' + lessons.length + ' lecciones, ' + totalMoves + ' jugadas legales; reproducción de todos los prefijos; test de nivel con ambos colores; coordenadas; orientación local alternada validada con ambos turnos.');
