const fs = require("fs");
const src = fs.readFileSync("F:/benchmark/L2_Intermediate/DoubleWishbone/sensenova-6.8-flash-lite/index_check.html", "utf8");
const sm = src.match(/<script>([\s\S]*?)<\/script>/);
const full = sm[1];
const cutIdx = full.indexOf("var state = {");
const js = full.slice(0, cutIdx);
const fn = new Function(js + "\nreturn {V:V,P:P,angBetween:angBetween,buildKnuckle:buildKnuckle,solveSide:solveSide};");
const m2 = fn();
const {V,P,angBetween,buildKnuckle,solveSide} = m2;

// Reproduce the constraint setup at b=0, r=0
var sideSign = 1;
var thetaL = 0;
var LBJ0 = [180, 30, 90];
var UBJ = [180, 216.828, 18.618];
var kpDir = V.norm(V.sub(UBJ, LBJ0));
var kpMid = V.scale(V.add(UBJ, LBJ0), 0.5);
var lateral = [1, 0, 0];
var longw = V.norm(V.cross(kpDir, lateral));
var lat2 = V.cross(longw, kpDir);
var saPoint = V.add(V.add(UBJ, V.scale(longw, P.steerArmOffsetZ)), V.scale(lat2, P.steerArmLen));
var restRack = [60, 215, 100];
var rackBall = [60, 215, 100];  // rack=0
var restSa = [215, 209.7, 0];
var tieRodLen = V.len(V.sub(restSa, restRack));
console.log("saPoint:", saPoint, "restSa:", restSa, "dist:", V.len(V.sub(saPoint, rackBall)), "tieRodLen:", tieRodLen);

var a = kpDir;
var d0 = V.sub(saPoint, kpMid);
var aDot = V.dot(a, d0);
var dAx = V.scale(a, aDot);
var dPerp = V.sub(d0, dAx);
var dCross = V.cross(a, d0);
var cVec = V.sub(kpMid, rackBall);
var v = V.add(dAx, cVec);
var D = dPerp; var E = dCross;
var Aa = V.dot(D,D), Bb=V.dot(E,E), Cc2=2*V.dot(D,E);
var dDv = 2*V.dot(D,v), dEv=2*V.dot(E,v);
var F = V.dot(v,v) - tieRodLen*tieRodLen;
console.log("Aa,Bb,Cc2,dDv,dEv,F:", Aa,Bb,Cc2,dDv,dEv,F);
console.log("F + Aa + dDv:", F + Aa + dDv);

// Now check scan: find min |err| over [-0.4, 0.4]
var bestTheta = 0, bestErr = 1e9;
for (var t = -0.4; t <= 0.4; t += 0.001) {
  var cos=Math.cos(t), sin=Math.sin(t);
  var err = Aa*cos*cos + Bb*sin*sin + Cc2*cos*sin + dDv*cos + dEv*sin + F;
  if (Math.abs(err) < bestErr) { bestErr = Math.abs(err); bestTheta = t; }
}
console.log("bestTheta:", bestTheta, "bestErr:", bestErr);
// Show err at t=0
var err0 = Aa + dDv + F;
console.log("err at t=0:", err0);
