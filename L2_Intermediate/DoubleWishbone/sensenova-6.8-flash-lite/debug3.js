const fs = require("fs");
const src = fs.readFileSync("F:/benchmark/L2_Intermediate/DoubleWishbone/sensenova-6.8-flash-lite/index_check.html", "utf8");
const sm = src.match(/<script>([\s\S]*?)<\/script>/);
const full = sm[1];
const cutIdx = full.indexOf("var state = {");
const js = full.slice(0, cutIdx);
const fn = new Function(js + "\nreturn {V:V,P:P,angBetween:angBetween,buildKnuckle:buildKnuckle,solveSide:solveSide};");
const m2 = fn();
const {V,P,angBetween,buildKnuckle,solveSide} = m2;

function solveSteer(bump, rack) {
  var sideSign = 1;
  var halfTrack = sideSign * P.side;
  var thetaL = (bump / P.bumpRange) * 0.45;
  var LP = [halfTrack, P.lowerPivotY, P.lowerPivotZ];
  var LBJ0 = [LP[0], P.lowerPivotY + P.lowerArmLen*Math.sin(thetaL), P.lowerPivotZ + P.lowerArmLen*Math.cos(thetaL)];
  var UP = [halfTrack, P.upperPivotY, P.upperPivotZ];
  var dy0 = UP[1] - LBJ0[1];
  var dz0 = UP[2] - LBJ0[2];
  var K = P.kingpinLen;
  var UL = P.upperArmLen;
  var Acoef = 2*(UL*dy0);
  var Bc = 2*(UL*dz0);
  var Cc = dy0*dy0 + dz0*dz0 + UL*UL - K*K;
  var k = Math.sqrt(Acoef*Acoef + Bc*Bc);
  var gamma = Math.atan2(Bc, Acoef);
  var rhs = -Cc/k;
  var phi0 = Math.asin(rhs) - gamma;
  var phi1 = Math.PI - Math.asin(rhs) - gamma;
  var y1 = UP[1] + UL*Math.sin(phi0);
  var y2 = UP[1] + UL*Math.sin(phi1);
  var phi = (y2 > y1) ? phi1 : phi0;
  var UBJ = [halfTrack, UP[1] + UL*Math.sin(phi), UP[2] + UL*Math.cos(phi)];
  var kpDir = V.norm(V.sub(UBJ, LBJ0));
  var kpMid = V.scale(V.add(UBJ, LBJ0), 0.5);
  var lateral = [1, 0, 0];
  var longw = V.norm(V.cross(kpDir, lateral));
  var lat2 = V.cross(longw, kpDir);
  var saPoint = V.add(V.add(UBJ, V.scale(longw, P.steerArmOffsetZ)), V.scale(lat2, P.steerArmLen));
  var restRack = [sideSign * 60, 215, 100];
  var rackBall = [restRack[0] + rack, restRack[1], restRack[2]];
  var restSa = [sideSign*215, 209.7, 0];
  var tieRodLen = V.len(V.sub(restSa, restRack));
  console.log("saPoint:", saPoint, "rackBall:", rackBall, "tieRodLen:", tieRodLen, "dist0:", V.len(V.sub(saPoint, rackBall)));

  function rotVec(v, axis, theta) {
    var c = Math.cos(theta), s = Math.sin(theta);
    var p = V.scale(axis, V.dot(axis, v));
    var q = V.sub(v, p);
    var r = V.cross(axis, v);
    return V.add(p, V.add(V.scale(q, c), V.scale(r, s)));
  }
  console.log("\nDistance at various theta:");
  for (var t = -0.4; t <= 0.4; t += 0.1) {
    var saRot = V.add(kpMid, rotVec(V.sub(saPoint, kpMid), kpDir, t));
    var d = V.len(V.sub(saRot, rackBall));
    console.log("  t=", t.toFixed(2), " dist=", d.toFixed(2), " delta=", (d-tieRodLen).toFixed(2));
  }
}
solveSteer(0, 60);
solveSteer(0, -60);
solveSteer(0, 0);
