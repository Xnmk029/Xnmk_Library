const fs = require("fs");

// Minimal DOM stubs so the solver script can execute
global.document = {
  getElementById: (id) => {
    if (id === 'cv') return {getContext:()=>({
      fillStyle:'', fillRect(){}, strokeStyle:'', lineWidth:0, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){},
      setLineDash(){}, fillRect(){}, fillText(){}
    }), parentElement:{getBoundingClientRect:()=>({width:800,height:600})}, addEventListener:()=>{}};
    return {value:0, textContent:'', innerHTML:'', classList:{toggle(){}, remove(){}}, addEventListener:()=>{}};
  },
  querySelectorAll: () => []
};
global.window = {addEventListener(){}, devicePixelRatio:1};
global.performance = {now:()=>0};
global.requestAnimationFrame = () => {};
global.Math = Math;

const src = fs.readFileSync("index.html", "utf8");
const sm = src.match(/<script>([\s\S]*?)<\/script>/);
const script = sm[1];
const fn = new Function(script + '; return [REST, solveSide, P];');
const [REST, solveSide, P] = fn();

console.log('=== Solver smoke test ===');
console.log('Rest: LBJ0='+JSON.stringify(REST.LBJ0)+' UBJ0='+JSON.stringify(REST.UBJ0)+' tieRodLen='+REST.tieRodLen.toFixed(2));
var cases = [
  ['rest', 0, 0],
  ['bump+40', 40, 0],
  ['bump-40', -40, 0],
  ['bump+80', 80, 0],
  ['bump-80', -80, 0],
  ['rack+30', 0, 30],
  ['rack-30', 0, -30],
  ['rack+60', 0, 60],
  ['rack-60', 0, -60],
  ['bump+rack+', 40, 30],
  ['bump+rack-', -40, -30],
  ['bump+80 rack+60', 80, 60],
];
cases.forEach(function(c){
  var L = solveSide(+1, c[1], c[2]);
  var R = solveSide(-1, c[1], -c[2]);
  var le = Math.max.apply(null, L.errs);
  var re = Math.max.apply(null, R.errs);
  var steerL = L.steerAngle * 180/Math.PI;
  var steerR = R.steerAngle * 180/Math.PI;
  var camL = L.camberDeg, camR = R.camberDeg;
  var toeL = L.toeDeg, toeR = R.toeDeg;
  var spL = L.springLen, spR = R.springLen;
  var kpL = L.kpiDeg, kpR = R.kpiDeg;
  console.log(c[0].padEnd(20)+' | L cam='+camL.toFixed(2)+' toe='+toeL.toFixed(2)+' kpi='+kpL.toFixed(2)+' steer='+steerL.toFixed(2)+' spr='+spL.toFixed(1)+' | R cam='+camR.toFixed(2)+' toe='+toeR.toFixed(2)+' steer='+steerR.toFixed(2)+' spr='+spR.toFixed(1)+' | maxErr='+Math.max(le,re).toExponential(2));
});

console.log('\n=== Symmetry check (L at +rack vs R at -rack) ===');
for (var bump of [0, 40, -40, 80]) {
  for (var rack of [-30, 0, 30]) {
    var L = solveSide(+1, bump, rack);
    var R = solveSide(-1, bump, -rack);
    // camber should be antisymmetric: cam_L(bump,rack) ~= -cam_R(bump,-rack)
    var camDiff = L.camberDeg - (-R.camberDeg);
    var toeDiff = (-L.toeDeg) - R.toeDeg;
    var steerDiff = (-L.steerAngle*180/Math.PI) - (R.steerAngle*180/Math.PI);
    console.log('b='+bump+' r='+rack+' cam_asym_err='+camDiff.toFixed(4)+' toe_asym_err='+toeDiff.toFixed(4)+' steer_asym_err='+steerDiff.toFixed(4));
  }
}

console.log('\n=== Camber continuity check (bump only) ===');
var bumps = [-80, -60, -40, -20, 0, 20, 40, 60, 80];
bumps.forEach(function(b){
  var L = solveSide(+1, b, 0);
  var cam = L.camberDeg;
  console.log('b='+b+'  cam='+cam.toFixed(2)+'  kpi='+L.kpiDeg.toFixed(2));
});
