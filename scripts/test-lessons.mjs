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
const pupilLessons = lessons.filter(row => String(row[5] || '').startsWith('PupiloChess ·'));
if (pupilLessons.length < 10) throw new Error('Se esperaban al menos 10 lecciones PupiloChess; encontradas: ' + pupilLessons.length);
let errors = 0;
for (const lesson of pupilLessons) {
  const chess = new Chess();
  const moves = String(lesson[1] || '').trim().split(/\s+/).filter(Boolean);
  let failedMove = '';
  try {
    for (const san of moves) {
      failedMove = san;
      chess.move(san);
    }
  } catch (error) {
    errors++;
    console.error('Línea ilegal:', lesson[0], '|', failedMove, '|', error.message);
  }
}
if (errors) process.exit(1);
console.log('OK: ' + pupilLessons.length + ' lecciones PupiloChess y todas sus secuencias son legales.');
