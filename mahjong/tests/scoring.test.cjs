const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync(require('path').join(__dirname, '../js/mahjong.js'), 'utf8') + '\nglobalThis.__applyWinRecordScores = applyWinRecordScores;';
const context = { console };
vm.runInNewContext(src, context);
const apply = context.__applyWinRecordScores;
function equal(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}
function zeroSum(scores, label) {
  const sum = scores.reduce((a,b)=>a+b,0);
  if (sum !== 0) throw new Error(`${label}: total must be zero, got ${sum}`);
}
// Self-draw: seat 0 wins while seats 1 and 3 remain active; seat 2 already won and is out.
let scores=[0,0,0,0];
apply(scores,{seat:0,method:'自摸',fan:2,payerSeats:[1,3]});
equal(scores,[4,-2,0,-2],'self draw only charges active players'); zeroSum(scores,'self draw');
// Discard win: only the actual discard player pays, not any other active player.
scores=[0,0,0,0];
apply(scores,{seat:2,method:'点炮',payerSeat:1,payerSeats:[1],fan:3});
equal(scores,[0,-3,3,0],'discard win payer'); zeroSum(scores,'discard win');
// Already-won/inactive payer is excluded; no accidental boolean-as-seat indexing.
scores=[0,0,0,0];
apply(scores,{seat:0,method:'自摸',fan:1,payerSeats:[false,true,3]});
equal(scores,[1,0,0,-1],'reject invalid boolean payer ids'); zeroSum(scores,'invalid payer IDs');
// Two separate win records are both applied exactly once, and remain zero-sum.
scores=[0,0,0,0];
apply(scores,{seat:0,method:'自摸',fan:2,payerSeats:[1,3]});
apply(scores,{seat:2,method:'点炮',payerSeat:3,payerSeats:[3],fan:1});
equal(scores,[4,-2,1,-3],'multiple win records'); zeroSum(scores,'multiple win records');
console.log('Scoring tests passed: 4 cases');
