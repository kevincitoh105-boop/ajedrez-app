const {Pos,perft,go}=require(require('path').join(__dirname,'../www/engine/maestro-engine.js'));
const T=[['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',4,197281],['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',3,97862],['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',5,674624],['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',4,422333]];
for(const [f,d,e] of T){const n=perft(new Pos(f),d);{console.log(n===e?'OK':'FAIL',n,e);if(n!==e)process.exitCode=1}}
if(process.exitCode)process.exit(1)
