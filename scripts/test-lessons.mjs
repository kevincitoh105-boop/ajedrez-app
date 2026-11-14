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
const setupStart = html.indexOf('function parseTheoryMoves');
const setupEnd = html.indexOf('\nconst LESSON_MIDGAME_CUTS', setupStart);
if (setupStart < 0 || setupEnd < 0) throw new Error('No se encontraron las posiciones temáticas de las clases.');
const planDefinitionsStart = html.indexOf('const MIDGAME_PLANS=');
const planDefinitionsEnd = html.indexOf('\nfunction renderMiddlegamePlans', planDefinitionsStart);
if (planDefinitionsStart < 0 || planDefinitionsEnd < 0) throw new Error('No se encontraron los 30 planes.');
const planDefinitionsSandbox = {};
vm.runInNewContext(html.slice(planDefinitionsStart, planDefinitionsEnd) + '\nglobalThis.__plans = MIDGAME_PLANS;', planDefinitionsSandbox);
const planSandbox = { Chess, L: lessons, MIDGAME_PLANS: planDefinitionsSandbox.__plans };
vm.runInNewContext(html.slice(setupStart, setupEnd) + '\nglobalThis.__planSetup = {LESSON_STARTS, PLAN_CLASS_META};', planSandbox);
for (const meta of planSandbox.__planSetup.PLAN_CLASS_META) {
  const setup = planSandbox.__planSetup.LESSON_STARTS[meta.index];
  if (!setup) throw new Error('Falta posición de tablero para ' + meta.label + ' · plan ' + (meta.planIndex + 1));
  const chess = new Chess(setup.fen);
  for (const san of parseMoves(setup.moves)) {
    try { chess.move(san); }
    catch (error) { throw new Error('Posición/continuación inválida en ' + meta.label + ' · plan ' + (meta.planIndex + 1) + ' | ' + san + ': ' + error.message); }
  }
  if (chess.isCheckmate() || chess.isStalemate() || chess.isDraw()) {
    throw new Error('El plan termina en una posición terminal o tablas sin resolver: ' + meta.label + ' · plan ' + (meta.planIndex + 1));
  }
}
if (planSandbox.__planSetup.PLAN_CLASS_META.length !== 30)
  throw new Error('Se esperaban 30 clases visuales de medio juego.');
const distinctPlanPositions = new Set(planSandbox.__planSetup.PLAN_CLASS_META.map(meta => planSandbox.__planSetup.LESSON_STARTS[meta.index].fen));
if (distinctPlanPositions.size < 20)
  throw new Error('Demasiadas clases comparten la misma posición de tablero: ' + distinctPlanPositions.size);
const cutsStart = html.indexOf('const LESSON_MIDGAME_CUTS=');
const cutsEnd = html.indexOf('\nfunction lessonData', cutsStart);
if (cutsStart < 0 || cutsEnd < 0) throw new Error('No se encontraron los puntos de entrada de las clases de medio juego.');
const cutsSandbox = {};
vm.runInNewContext(html.slice(cutsStart, cutsEnd) + '\nglobalThis.__lessonCuts = LESSON_MIDGAME_CUTS;', cutsSandbox);
for (const [index, cut] of Object.entries(cutsSandbox.__lessonCuts)) {
  const moves = parseMoves(lessons[+index][1]), board = new Chess();
  if (cut < 1 || cut >= moves.length) throw new Error('Corte temático inválido en lección ' + (+index + 1));
  for (const san of moves.slice(0, cut)) board.move(san);
  if (board.fen() === new Chess().fen()) throw new Error('La lección no abandonó la posición inicial: ' + lessons[+index][0]);
  for (const san of moves.slice(cut)) {
    try { board.move(san); }
    catch (error) { throw new Error('Línea temática inválida en ' + lessons[+index][0] + ' | ' + san + ': ' + error.message); }
  }
}
if (lessons.length !== 82) throw new Error('Se esperaban 82 lecciones (74 existentes + 8 clases didácticas originales nuevas); encontradas: ' + lessons.length);
for (let i = 36; i < 42; i++) {
  if (!lessons[i]?.[0]?.includes('PupiloChess') || !planSandbox.__planSetup.LESSON_STARTS[i])
    throw new Error('Falta una lección interactiva del video o su posición didáctica: índice ' + i);
  if (!String(lessons[i][5] || '').includes('PupiloChess') ||
      !/^[A-Za-z0-9_-]{11}$/.test(String(lessons[i][6] || '')))
    throw new Error('Falta la referencia verificable al vídeo fuente de la lección: ' + lessons[i][0]);
}

const operaLesson = lessons[42], operaPuzzle = lessons[43];
if (!operaLesson?.[0]?.includes('Morphy') || !operaLesson[1]?.includes('17.Rd8#'))
  throw new Error('Falta la partida histórica completa de Morphy.');
if (!operaLesson[3]?.includes('8.Nc3!') || !operaLesson[3]?.includes('3...Nf6') || !operaLesson[3]?.includes('10...Qb4+'))
  throw new Error('La clase histórica no explica la jugada crítica y sus alternativas documentadas.');
if (!operaLesson[6]?.includes('chesshistory.com') || !operaLesson[6]?.includes('wikipedia.org'))
  throw new Error('La partida histórica no incluye sus fuentes de verificación.');
const operaReplay = new Chess();
for (const san of parseMoves(operaLesson[1])) operaReplay.move(san);
if (operaReplay.history().length !== 33 || !operaReplay.isCheckmate())
  throw new Error('La partida de la Ópera debe reproducir 33 medias jugadas legales y terminar en mate.');
if (!operaPuzzle?.[0]?.includes('Desafío interactivo') || !operaPuzzle[1]?.includes('16.Qb8+'))
  throw new Error('Falta el ejercicio interactivo del sacrificio de dama.');
const operaPuzzleSetup = planSandbox.__planSetup.LESSON_STARTS[43];
if (!operaPuzzleSetup) throw new Error('No se generó la posición histórica después de 15...Nxd7.');
const operaPuzzleMoves = parseMoves(operaPuzzleSetup.moves);
if (operaPuzzleMoves.join(' ') !== 'Qb8+ Nxb8 Rd8#')
  throw new Error('La combinación final de Morphy no coincide con la partida documentada.');
const operaPuzzleBoard = new Chess(operaPuzzleSetup.fen);
for (const san of operaPuzzleMoves) operaPuzzleBoard.move(san);
if (!operaPuzzleBoard.isCheckmate())
  throw new Error('El ejercicio de Morphy no termina en jaque mate legal.');

const plansStart = html.indexOf('const MIDGAME_PLANS=');
const plansEnd = html.indexOf('\nfunction renderMiddlegamePlans', plansStart);
if (plansStart < 0 || plansEnd < 0) throw new Error('No se encontró la guía de medio juego.');
const plansSandbox = {};
vm.runInNewContext(html.slice(plansStart, plansEnd) + '\nglobalThis.__plans = MIDGAME_PLANS;', plansSandbox);
for (const opening of ['caro', 'ortodoxa', 'londres']) {
  const count = plansSandbox.__plans[opening]?.plans?.length || 0;
  if (count !== 10) throw new Error('Se esperaban 10 planes de medio juego para ' + opening + '; encontrados: ' + count);
}
if (!html.includes('id="home"') || !html.includes('data-enter="records"'))
  throw new Error('Falta la portada inicial con selector de secciones.');
if (!html.includes("mode==='local'?false:mode==='train'?G.trainSide==='b':flipped()"))
  throw new Error('El tablero local no conserva una orientación fija.');
if (html.includes("T.c.load(before);T.arrow={from:bestMove.from"))
  throw new Error('El entrenador todavía obliga a repetir una jugada.');
const demoStart = html.indexOf('async function nextTrainingDemoMove()');
const demoEnd = html.indexOf('async function trainingDemoMove(', demoStart);
if (demoStart < 0 || demoEnd < 0 || html.slice(demoStart, demoEnd).includes('G.g.move('))
  throw new Error('La continuación debe sugerir con flecha y esperar la decisión del usuario.');
if (!html.includes("if(moveReview)moveReview.hidden=mode!=='play'&&mode!=='local'"))
  throw new Error('Los mensajes de evaluación no se ocultan en teoría, entrenar y registros.');


function parseMoves(raw) {
  return String(raw || '').replace(/\{[^}]*\}/g, ' ').replace(/;[^\n]*/g, ' ').replace(/\$\d+/g, ' ')
    .split(/\s+/).map(token => token.replace(/^\d+\.(?:\.\.)?/, '').replace(/[!?]+$/, ''))
    .filter(token => token && !/^\d+\.(?:\.\.)?$/.test(token) && !/^\.\.\.$/.test(token)
      && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token) && token !== 'e.p.');
}

let totalMoves = 0;
for (const [lessonIndex, lesson] of lessons.entries()) {
  const planSetup = planSandbox.__planSetup.LESSON_STARTS[lessonIndex];
  const chess = planSetup ? new Chess(planSetup.fen) : new Chess();
  // Las 30 clases de medio juego guardan sus jugadas en LESSON_STARTS,
  // no en L[index][1], porque su posición inicial es temática.
  // Si la aplicación define un FEN y una línea propios para la lección,
  // esos datos tienen prioridad sobre la línea PGN general de L[index].
  const moves = planSetup ? parseMoves(planSetup.moves) : parseMoves(lesson[1]);
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
    // Las clases con posición temática deben reconstruirse desde su FEN,
    // igual que la reproducción principal, no desde la posición inicial.
    const replay = planSetup ? new Chess(planSetup.fen) : new Chess();
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
if (!html.includes("f:mode==='local'?false:mode==='train'?G.trainSide==='b':flipped()"))
  throw new Error('La orientación del tablero no respeta el turno local ni el color del ejercicio.');
const localGame = new Chess();
if (localGame.turn() !== 'w') throw new Error('La partida local debe empezar con blancas abajo.');
localGame.move('e4');
if (localGame.turn() !== 'b') throw new Error('Tras la jugada blanca, debe quedar el turno negro.');
localGame.move('e5');
if (localGame.turn() !== 'w') throw new Error('Tras la jugada negra, debe volver el turno blanco.');

const requiredFeatures = [
  ['animación de piezas', 'async function animatePieceMoves'],
  ['animación del motor', 'await animatePieceMoves(animationForMove(candidate,G.g.turn()))'],
  ['repetición espaciada', 'localStorage.chessMistakeBank'],
  ['entrenador de errores', 'function startTraining()'],
  ['revisión completa de partida', 'async function reviewGame()'],
  ['pestaña Entrenar', "$('#t4').onclick"],
  ['navegación de teoría animada', 'async function step(d,abs)'],
  ['clase interactiva guiada', 'async function lessonMove(m)'],
  ['respuesta automática del rival', 'async function runGuidedReplies()'],
  ['pistas con flechas', 'function guidedHint()'],
  ['avatar del entrenador', 'assets/coach.webp'],
  ['selección de color en lecciones', 'id="lessonSide"'],
  ['entrenador que acepta decisiones propias', 'async function lessonMove(m)'],
  ['respuesta del rival calculada en directo', "const fen=T.c.fen(),result=await ask(fen,'depth 10',adaptiveEngineLevel(lessonStats()))"],
  ['análisis de la jugada del alumno', "const after=await ask(afterFen,'depth 12',16)"],
  ['pistas calculadas para la posición actual', 'async function guidedHint()'],
  ['duración de clase basada en las jugadas reales del repertorio', 'for(const san of T.m){try{const played=countLine.move(san);if(played&&played.color===T.humanSide)T.guidedLimit++}catch(e){T.guidedLineActive=false;break}}'],
  ['el rival sigue la línea propia de cada lección', 'const scripted=new Chess(T.c.fen());try{const expected=scripted.move(T.m[T.guidedLineIndex])'],
  ['las desviaciones activan respuestas dinámicas de Stockfish', "if(!response){const fen=T.c.fen(),result=await ask(fen,'depth 10',adaptiveEngineLevel(lessonStats()))"],
  ['se valida la jugada objetivo de cada alumno', 'if(expected&&expected.color===T.humanSide)expectedSan=expected.san'],
  ['conserva la explicación después de la respuesta rival', 'prior=T.pendingCoach;T.pendingCoach=null;'],
  ['restaura la pieza original al terminar la animación', "x.piece.style.visibility=''"],
  ['protege contra animaciones atascadas en Android WebView', 'new Promise(resolve=>{timer=setTimeout(resolve,450)})'],
  ['muestra la jugada antes de analizarla', "coachMessage('Estoy estudiando tu jugada…'"],
  ['abre la pestaña de teoría al iniciar una clase desde el entrenador', 'function openGuidedLesson(restart=false)'],
  ['conecta comenzar clase interactiva', "$('#guidedStart').onclick=()=>openGuidedLesson(false)"],
  ['conecta reiniciar clase', "$('#guidedRetry').onclick=()=>openGuidedLesson(true)"],
  ['pista y siguiente clase abren el modo teoría', "$('#guidedHint').onclick=()=>{if(mode!=='theory')"],
  ['muestra las acciones de entrenar en el panel del entrenador', 'tools.append(actions)'],
  ['sitúa el estado de evaluación bajo los controles', 'id="analysisStatus"'],
  ['incluye estado de evaluación en partidas locales', 'id="analysisStatusLocal"'],
  ['guarda el diagnóstico de la jugada del alumno', 'T.pendingCoach={title,message,status:'],
  ['panel del entrenador situado antes del tablero', 'id="coachPanel" class="coach-panel" hidden>'],
  ['botón de iniciar clase conectado', "$('#guidedStart').onclick"],
  ['botón de pista conectado', "$('#guidedHint').onclick=()=>{if(mode!=='theory')"],
  ['reinicio de clase conectado', "$('#guidedRetry').onclick"],
  ['siguiente clase conectado', "$('#guidedNext').onclick=()=>{if(mode!=='theory')"],
  ['entrenamiento alternativo desde las lecciones', 'function courseTrainingPositions()'],
  ['pista de entrenamiento calculada por Stockfish', "ask(G.g.fen(),'depth 12',20)"],
  ['evaluación colocada debajo de los controles', "(mode==='local'?$('#local'):$('#play')).after(box)"],
  ['la pieza se restaura si falla o termina la animación', "x.piece.style.visibility=''"],
  ['evalúa una mala jugada sin forzar la alternativa', 'const needsReview=loss>threshold;'],
  ['registra intentos y progreso por lección', 'localStorage.chessLessonStats'],
  ['explica el objetivo estratégico de cada clase', "'Objetivo de esta clase: '+L[T.lesson][2]"],
  ['hace preguntas para comprobar la comprensión', 'function showLessonQuiz()'],
  ['no deja saltarse la pregunta de comprensión', 'if(T.animating||T.quizPending)return'],
  ['ajusta el umbral de evaluación según el dominio', 'function adaptiveThreshold(stats)'],
  ['adapta la fuerza del rival según el progreso', 'function adaptiveEngineLevel(stats)'],
  ['muestra el cuestionario en el panel del entrenador', 'id="coachQuiz" class="coach-quiz"'],
  ['pestaña de registros', 'id="t5">Registros</button>'],
  ['sección de registros', 'id="records" hidden'],
  ['archivo persistente de partidas', 'localStorage.chessRecords'],
  ['fecha exacta de las partidas', 'function exactDate(ms)'],
  ['nombre editable de la partida', 'Guardar nombre'],
  ['clasificación de todas las jugadas', "loss<=15?'EXCELENTE':loss<=40?'BUENA':loss<=100?'IMPRECISA':'ERROR GRAVE'"],
  ['tendencia de errores entre las últimas partidas', 'La tendencia reciente mejora.'],
  ['alternativas accesibles desde el registro', 'function showRecordAlternative(id,m)'],
  ['guardado automático después de cada jugada', 'saveCurrentRecord();render()'],
  ['explicación ajedrecística de la solución de Entrenar', 'function explainTrainingMove(item,move)'],
  ['continuación guiada desde la jugada resuelta', 'function beginTrainingDemo()'],
  ['cancelar la continuación guiada', 'function cancelTrainingDemo()'],
  ['progreso persistente del entrenamiento', 'localStorage.chessTrainingProgress'],
  ['reanuda después del último ejercicio completado', 'saveTrainingProgress(R.items[R.index]===R.current?R.index+1:R.index)'],
  ['posiciones iniciales temáticas para finales', 'const LESSON_STARTS='],
  ['reproducción de la línea desde la posición temática', 'new Chess(T.startFen)'],
  ['conteo de respuestas guiadas desde el FEN temático', 'const countLine=new Chess(T.startFen)'],
  ['el alumno con negras aprende a evitar la trampa', "T.humanSide==='b'&&(T.lesson===7||T.lesson===10)"],
  ['planes de medio juego de la Caro-Kann', 'caro:{title:'],
  ['planes de medio juego de la Defensa Ortodoxa', 'ortodoxa:{title:'],
  ['planes de medio juego del Sistema Londres', 'londres:{title:'],
  ['selector de planes para posiciones bloqueadas', 'id="planOpening"'],
  ['interruptor de premovimientos', 'id="optPremove"'],
  ['ejecución segura de premovimientos', 'async function applyQueuedPremove()'],
  ['chat de partida', 'id="chatPanel"'],
  ['selector de idiomas con traducción de controles', 'function applyLanguage(lang)'],
  ['clasificación de jugada teórica como de manual', 'DE MANUAL · '],
  ['pistas permanentes del entrenador', 'if(T.guided&&!T.c.isGameOver())await guidedHint();'],
  ['curso ampliado de cálculo', 'Clase 75 · Cálculo de variantes'],
  ['curso ampliado de estrategia', 'Clase 82 · Convertir una ventaja sin precipitarse']
];
for (const [name, marker] of requiredFeatures) {
  if (!html.includes(marker)) throw new Error('Falta implementar o conectar: ' + name);
}
const moduleStart = html.indexOf('<script type="module">');
const moduleEnd = html.indexOf('</script>', moduleStart);
if (moduleStart < 0 || moduleEnd < 0) throw new Error('No se encontró el módulo JavaScript principal.');
const inline = html.slice(moduleStart + '<script type="module">'.length, moduleEnd)
  .replace(/^\s*import\s+\{\s*Chess\s*\}\s+from\s+['"][^'"]+['"];?\s*/, '');
new vm.Script(inline, { filename: 'index-inline.js' });
console.log('OK: ' + lessons.length + ' lecciones, ' + totalMoves + ' jugadas legales; reproducción de todos los prefijos; test de nivel con ambos colores; coordenadas; orientación fija para dos jugadores; animaciones; entrenador espaciado; revisión de partidas; sintaxis JavaScript validada.');
