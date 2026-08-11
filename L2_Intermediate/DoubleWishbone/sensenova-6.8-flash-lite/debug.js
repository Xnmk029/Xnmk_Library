const V = {
  add:function(a,b){return[a[0]+b[0],a[1]+b[1],a[2]+b[2]]},
  sub:function(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]]},
  scale:function(a,s){return[a[0]*s,a[1]*s,a[2]*s]},
  dot:function(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]},
  cross:function(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]},
  len:function(a){return Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2])},
  norm:function(a){var l=Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]);if(l<1e-12)return[0,0,0];return[a[0]/l,a[1]/l,a[2]/l]}
};

var P = {
  side: 180,
  lowerPivotZ: -120, lowerPivotY: 30, lowerArmLen: 210,
  lowerArmRestAngle: -0.15,
  upperPivotZ: -150, upperPivotY: 175, upperArmLen: 165,
  kingpinLen: 200,
};

var halfTrack = P.side;
var thetaL0 = P.lowerArmRestAngle;
var LP = [halfTrack, P.lowerPivotY, P.lowerPivotZ];
var LBJ0 = [LP[0], LP[1] + P.lowerArmLen*Math.sin(thetaL0),
            LP[2] + P.lowerArmLen*Math.cos(thetaL0)];
var UP = [halfTrack, P.upperPivotY, P.upperPivotZ];
console.log('LBJ0:', JSON.stringify(LBJ0));
console.log('UP:  ', JSON.stringify(UP));
var dy0 = UP[1] - LBJ0[1], dz0 = UP[2] - LBJ0[2];
console.log('dy0=', dy0, 'dz0=', dz0, 'dist(UP,LBJ0)=', Math.sqrt(dy0*dy0+dz0*dz0));
var UL = P.upperArmLen, K = P.kingpinLen;
console.log('UL=', UL, 'K=', K, 'UL-K=', UL-K, 'UL+K=', UL+K);
var Acoef = 2*(UL*dy0), Bc = 2*(UL*dz0);
var Cc = dy0*dy0 + dz0*dz0 + UL*UL - K*K;
var k = Math.sqrt(Acoef*Acoef + Bc*Bc);
console.log('Acoef=', Acoef, 'Bc=', Bc, 'Cc=', Cc, 'k=', k);
var gamma = Math.atan2(Bc, Acoef);
var rhs = -Cc/k;
console.log('gamma=', gamma, 'rhs=', rhs, '|rhs|=', Math.abs(rhs));

var phi;
if (Math.abs(rhs) > 1) {
  phi = Math.asin(0.999*Math.sign(rhs)) - gamma;
  console.log('CLAMPED phi:');
} else {
  var phi0 = Math.asin(rhs) - gamma;
  var phi1 = Math.PI - Math.asin(rhs) - gamma;
  var y0 = UP[1] + UL*Math.sin(phi0);
  var y1 = UP[1] + UL*Math.sin(phi1);
  console.log('phi0=', phi0, 'y0=', y0);
  console.log('phi1=', phi1, 'y1=', y1);
  phi = (y1 > y0) ? phi1 : phi0;
}
var UBJ0 = [halfTrack, UP[1] + UL*Math.sin(phi), UP[2] + UL*Math.cos(phi)];
console.log('UBJ0:', JSON.stringify(UBJ0));
console.log('kingpin len =', V.len(V.sub(UBJ0, LBJ0)));
console.log('UBJ-UP len =', V.len(V.sub(UBJ0, UP)));

var kpDir = V.norm(V.sub(UBJ0, LBJ0));
console.log('kpDir:', JSON.stringify(kpDir));

// Left side (sideSign=+1): outboard = -X
var lateral_left = [-1, 0, 0];
var longw_left = V.norm(V.cross(kpDir, lateral_left));
console.log('Left: longw=', JSON.stringify(longw_left));
var lat2_left = V.cross(longw_left, kpDir);
console.log('Left: lat2=', JSON.stringify(lat2_left), ' norm=', JSON.stringify(V.norm(lat2_left)));

// Right side (sideSign=-1): outboard = +X
var lateral_right = [1, 0, 0];
var longw_right = V.norm(V.cross(kpDir, lateral_right));
console.log('Right: longw=', JSON.stringify(longw_right));
var lat2_right = V.cross(longw_right, kpDir);
console.log('Right: lat2=', JSON.stringify(lat2_right), ' norm=', JSON.stringify(V.norm(lat2_right)));
