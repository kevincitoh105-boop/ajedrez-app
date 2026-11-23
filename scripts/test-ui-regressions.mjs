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

// Premoves are intentionally unavailable in local two-player mode.
const premove = section('function premoveTap(', '\nasync function applyQueuedPremove');
assert.doesNotMatch(premove, /mode==='local'/);
assert.match(premove, /mode!=='play'/);
const tap = section('function tap(', '\nfunction promo');
assert.doesNotMatch(tap, /shouldInterceptLocalPremove/);
assert.doesNotMatch(html, /function shouldInterceptLocalPremove/);
const enterLocal = section('function enterLocal()', "\n$('#t1').onclick");
assert.match(enterLocal, /G\.premove=null;G\.premoveSel=null;G\.premoveSide=null/);
const localCapture = new Chess('r6k/8/8/8/8/8/p7/R6K w - - 0 1');
assert.ok(localCapture.moves({ square: 'a1', verbose: true }).some(m => m.to === 'a2'),
  'Normal local captures remain legal when premoves are disabled');
// Conditional recapture premove: the destination is occupied by a friendly
// piece before the opponent captures it, so it is not currently legal.
const recaptureFen = '7k/8/4p3/3p4/4P3/8/8/K7 w - - 0 1';
const recaptureSetup = new Chess(recaptureFen);
const blackView = new Chess(recaptureFen.replace(/ ([wb]) /, ' b '));
assert.equal(blackView.get('d5').color, 'b');
assert.equal(blackView.moves({ square: 'e6', verbose: true }).some(m => m.to === 'd5'), false);
const capturedPawn = recaptureSetup.move({ from: 'e4', to: 'd5' });
assert.equal(capturedPawn.captured, 'p');
assert.ok(recaptureSetup.moves({ square: 'e6', verbose: true }).some(m => m.to === 'd5'),
  'e6xd5 must become legal only after White captures on d5');
const noCapture = new Chess(recaptureFen);
noCapture.move({ from: 'a1', to: 'a2' });
const noCaptureLast = noCapture.history({ verbose: true }).slice(-1)[0];
assert.equal(!!(noCaptureLast.captured && noCaptureLast.to === 'd5'), false,
  'the queued recapture must be discarded when the opponent does not capture on d5');

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
assert.match(html, /\.coach-panel\{[^}]*min-height:290px[^}]*max-height:none/s);
assert.match(html, /\.coach-copy #coachMessage\{[^}]*min-height:100px[^}]*max-height:210px[^}]*overflow-y:auto/s);
assert.match(html, /conditional=!candidate&&occupiedByOwn/);
assert.match(html, /if\(m\.conditional\)\{const last=G\.g\.history\(\{verbose:true\}\)\.slice\(-1\)\[0\]/);
assert.match(html, /last\.captured\|\|last\.to!==m\.to/);
assert.match(html, /id="localMinutes"/);
for (const minutes of ['3','5','10','20']) assert.match(html, new RegExp('<option value="'+minutes+'"'));
assert.match(html, /function tickLocalClock\(\)/);
assert.match(html, /function finishLocalOnTime\(loser\)/);
assert.match(html, /function finish\(t\)\{G\.over=true;if\(mode==='local'\)\{if\(localClock\.interval\)clearInterval/);
assert.match(html, /Tiempo agotado\. Ganan /);
assert.match(html, /localClockBeforeMove\(mover\)/);
assert.match(html, /localClockAfterMove\(mover\)/);
assert.match(html, /const nextChecks=checks\.map/);
assert.match(html, /const defendedBy=new Chess\(before\)\.attackers\(actual\.to/);
assert.match(html, /const enemy=mover==='w'\?'b':'w',attacks=after\.attackers\(actual\.to/);
assert.doesNotMatch(html, /Comprueba si la pieza capturada estaba defendida y qué queda desprotegido/);
assert.doesNotMatch(html, /Desarrollaste una pieza menor\. Comprueba si controla casillas centrales/);
assert.match(html, /nextCaptures=captures\.map/);
assert.doesNotMatch(html, /Antes de confirmar una jugada, haz una pausa y busca en este orden/);

// New mistake records keep the actual played move, which is drawn in red.
assert.match(html, /playedUci:uci/);
assert.match(html, /item\.playedUci\?\{from:item\.playedUci\.slice\(0,2\),to:item\.playedUci\.slice\(2,4\),kind:'wrong'\}/);
assert.match(html, /hint\.kind==='wrong'\?'#dc4545':'#299c58'/);

// The explanation must name concrete attacked squares and only claim a pawn
// break when a candidate can be described from the current board.
const explanation = section('function explainTrainingMove(', '\nasync function beginTrainingDemo');
assert.match(explanation, /controla casillas libres como/);
assert.match(explanation, /rupturas candidatas para calcular/);
assert.match(explanation, /no detecto una ruptura de peón inmediata verificable/);

// A hint must be based on the engine's actual best move, not on any unrelated
// legal capture elsewhere in the position.
const hintHandler = html.slice(html.indexOf("$('#trainHint').onclick="), html.indexOf("$('#trainReveal').onclick="));
assert.match(hintHandler, /if\(best\.captured\)/);
assert.doesNotMatch(hintHandler, /best\.captured\s*\|\|\s*captures/);

const localResult = section('function overText(', '\nconst vib');
assert.match(localResult, /mode==='local'/);
assert.match(localResult, /c\.turn\(\)==='w'\?'negras':'blancas'/);
assert.match(html, /Mensajes locales \(este teléfono\)/);

// Every square receives an explicit inline background color, independent of WebView class styling.
assert.match(html, /palette=\(\{classic:\['#f7fbff','#2e8b57'\],blue:\['#f1f5f9','#3976a8'\],wood:\['#f7fbff','#9b6845'\],slate:\['#cbd5e1','#475569'\],purple:\['#e9d5ff','#7653a6'\]\}\)/);
assert.match(html, /d\.style\.setProperty\('background-color',\(\(r\+k\)%2\)\?palette\[1\]:palette\[0\],'important'\)/);

// Check indication and red premove highlighting are explicitly styled.
assert.match(html, /#board \.sq\.chk\{[^}]*!important/);
assert.match(html, /\.sq\.premove-from/);
assert.match(html, /\.sq\.premove-to/);


 // Theory actions must not apply stale moves after the user switches lesson
 // while an animation or engine evaluation is pending.
 const theoryMove = section('async function lessonMove(m){', '\nasync function guidedHint');
 assert.match(theoryMove, /const session=T\.session,board=T\.c/);
 assert.match(theoryMove, /session!==T\.session\|\|T\.c!==board\|\|board\.fen\(\)!==before/);
 assert.match(theoryMove, /session!==T\.session\|\|T\.c!==board/);
 assert.match(html, /T\.session\+\+;T\.animating=false;T\.lesson=/);
 const theoryReplies = section('async function runGuidedReplies(){', '\nfunction lessonTap');
 assert.match(theoryReplies, /const session=T\.session,board=T\.c/);
 assert.match(theoryReplies, /session!==T\.session\|\|T\.c!==board/);

 // Eight supported languages translate original static and newly generated UI text.
 assert.match(html, /const TRANSLATIONS=\{/);
 assert.match(html, /en:0,pt:1,fr:2,de:3,ru:4,zh:5,ar:6/);
 assert.match(html, /function translateTree\(root\)/);
 assert.match(html, /new MutationObserver\(/);
 assert.match(html, /activeLanguage==='ar'\?'rtl':'ltr'/);
 assert.match(html, /translateRuntime\(statusSource\)/);

 // Android/device Back returns through the in-app navigation history.
 assert.match(html, /modeTrail\.length\?modeTrail\.pop\(\):'home'/);
 assert.match(html, /backNavigating=true;lastRenderedMode=previous;tabs\(\)/);
 assert.match(html, /window\.addEventListener\('popstate'/);
 assert.match(html, /e\.key==='Escape'\|\|e\.key==='Backspace'/);

// The coach asset is included in the Android web bundle and eagerly requested.
assert.ok(fs.existsSync('assets/coach.webp'), 'Coach image must exist in the repository');
assert.ok(fs.existsSync('www/assets/coach.webp'), 'Coach image must be copied into the Android web bundle');
assert.match(prepare, /assets\/coach\.webp/);
assert.match(html, /loading="eager" decoding="async"/);
assert.match(html, /avatar\.decode\(\)\.then/);

assert.match(html, /'optPremove'\]\.forEach\(id=>\$\('#'\+id\)\.onchange=saveSettingOptions\)/);
assert.doesNotMatch(html, /readOption\('premove',false\)/);
assert.match(html, /readOption\('premove',true\)/);
assert.match(html, /function appBack\(\)/);
assert.match(html, /window\.addEventListener\('popstate'/);
assert.match(html, /A\.review=null/);
assert.match(html, /epoch!==gameEpoch\|\|mode!=='play'/);
assert.match(html, /const modeGames=\{play:null,local:null/);
assert.match(html, /function enterPlay\(\)/);
assert.match(html, /function enterLocal\(\)/);
assert.match(html, /epoch!==gameEpoch\|\|mode!==expectedMode/);
assert.match(html, /async function move\(m\)\{[\s\S]*?const epoch=gameEpoch,expectedMode=mode,game=G\.g/);
console.log('UI regression checks passed: no local premoves, theory async-state protection, enlarged coach panel, eight-language UI translation, back navigation, red mistake arrow, grounded hints, and coach asset.');
