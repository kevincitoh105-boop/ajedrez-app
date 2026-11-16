import fs from 'node:fs';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';

const html = fs.readFileSync('index.html', 'utf8');
const prepare = fs.readFileSync('scripts/prepare-www.js', 'utf8');

function section(start, end) {
  const a = html.indexOf(start);
  const b = html.indexOf(end, a + start.length);
  assert.notEqual(a, -1, 'Missing source section: ' + start);
  assert.notEqual(b, -1, 'Missing end marker: ' + end);
  return html.slice(a, b);
}

// Local premoves must be selectable while the current player is thinking,
// and must never depend on the engine's busy flag.
const premove = section('function premoveTap(', '\nasync function applyQueuedPremove');
assert.match(premove, /mode==='local'/);
assert.match(premove, /mode==='play'&&!G\.busy/);\nassert.match(premove, /mode==='local'&&G\.busy/);
const tap = section('function tap(', '\nfunction promo');
assert.match(tap, /mode==='local'&&readOption\('premove',false\)/);
assert.match(tap, /piece\.color!==G\.g\.turn\(\)/);

// Simulate a queued black move after White's move, then a queued white move
// after Black's move. This checks both colors and the side-to-move transition.
const game = new Chess();
const blackTurnView = new Chess(game.fen().replace(/ ([wb]) /, ' b '));
assert.ok(blackTurnView.moves({ square: 'e7', verbose: true }).some(m => m.to === 'e5'));
game.move('e4');
const blackMove = game.moves({ square: 'e7', verbose: true }).find(m => m.to === 'e5');
assert.ok(blackMove, 'Queued black e5 should remain legal after 1.e4');
game.move({ from: blackMove.from, to: blackMove.to });
assert.equal(game.turn(), 'w');
const whiteTurnView = new Chess(game.fen().replace(/ ([wb]) /, ' w '));
assert.ok(whiteTurnView.moves({ square: 'd2', verbose: true }).some(m => m.to === 'd4'));
game.move('Nc6');
const whiteMove = game.moves({ square: 'd2', verbose: true }).find(m => m.to === 'd4');
assert.ok(whiteMove, 'Queued white d4 should remain legal after ...Nc6');
game.move({ from: whiteMove.from, to: whiteMove.to });
assert.equal(game.turn(), 'b');

// A continuation from a training position is user-controlled for both sides.
// The engine may suggest moves, but must not apply the opponent's reply.
const beginDemo = section('async function beginTrainingDemo(', '\nasync function nextTrainingDemoMove');
const nextDemo = section('async function nextTrainingDemoMove(', '\nasync function trainingDemoMove');
const demoMove = section('async function trainingDemoMove(', '\nfunction cancelTrainingDemo');
assert.match(beginDemo, /await nextTrainingDemoMove\(\)/);
assert.match(nextDemo, /const side=G\.g\.turn\(\)/);
assert.doesNotMatch(demoMove, /G\.g\.move\(\{from:reply/);
assert.match(demoMove, /if\(suggestNext\)await nextTrainingDemoMove\(\)/);

// The explanation panel scrolls internally instead of pushing the board.
assert.match(html, /#coachMessage\{[^}]*max-height:[^}]*overflow-y:auto/s);
assert.match(html, /overscroll-behavior:contain/);

// New mistake records keep the actual played move, which is drawn in red.
assert.match(html, /playedUci:uci/);
assert.match(html, /item\.playedUci\?\{from:item\.playedUci\.slice\(0,2\),to:item\.playedUci\.slice\(2,4\),kind:'wrong'\}/);
assert.match(html, /hint\.kind==='wrong'\?'#dc4545':'#299c58'/);

// The explanation must name concrete attacked squares and only claim a pawn
// break when a candidate can be described from the current board.
const explanation = section('function explainTrainingMove(', '\nasync function beginTrainingDemo');
assert.match(explanation, /controls casillas libres como/);
assert.match(explanation, /rupturas candidatas para calcular/);
assert.match(explanation, /no detecto una ruptura de peón inmediata verificable/);

// A hint must be based on the engine's actual best move, not on any unrelated
// legal capture elsewhere in the position.
const hintHandler = html.slice(html.indexOf("$('#trainHint').onclick="), html.indexOf("$('#trainReveal').onclick="));
assert.match(hintHandler, /if\(best\.captured\)/);
assert.doesNotMatch(hintHandler, /best\.captured\s*\|\|\s*captures/);

// Check indication and red premove highlighting are explicitly styled.
assert.match(html, /#board \.sq\.chk\{[^}]*!important/);
assert.match(html, /\.sq\.premove-from/);
assert.match(html, /\.sq\.premove-to/);

// The coach asset is included in the Android web bundle and eagerly requested.
assert.ok(fs.existsSync('assets/coach.webp'), 'Coach image must exist in the repository');
assert.ok(fs.existsSync('www/assets/coach.webp'), 'Coach image must be copied into the Android web bundle');
assert.match(prepare, /assets\/coach\.webp/);
assert.match(html, /loading="eager" decoding="async"/);

console.log('UI regression checks passed: local premoves both colors, no auto-play in continuation, independent coach scroll, red mistake arrow, grounded hints, check/premove indicators, coach asset.');
