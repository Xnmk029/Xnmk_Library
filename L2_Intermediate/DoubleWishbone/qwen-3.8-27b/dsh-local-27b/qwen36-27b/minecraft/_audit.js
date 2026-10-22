// Static GLSL audit: extract each shader string from the game, and cross-check
// that every identifier used in the body is declared/injected in that shader.
const fs = require('fs');
const html = fs.readFileSync('D:/workspace/AI-coding-test/xiaoming/voxelcraft/index.html', 'utf8');
const jsBlock = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

// Pull backtick template literals that look like shaders (contain 'void main').
const shaderRe = /`([\s\S]*?void\s+main[\s\S]*?)`/g;
let m, idx = 0, errors = 0;
while ((m = shaderRe.exec(jsBlock))) {
  idx++;
  const src = m[1];
  auditShader(src, 'shader #' + idx);
}

function auditShader(src, name){
  // Declared built-ins / uniforms / attributes / varyings / precision
  const declared = new Set();
  const re = /\b(?:uniform|attribute|varying)\s+\w+\s+(\w+)/g;
  let mm; while ((mm = re.exec(src))) declared.add(mm[1]);
  // precision + void main + control keywords etc are fine
  declared.add('gl_FragColor'); declared.add('gl_Position');

  // Extract the body after 'void main'
  const body = src.split('void main')[1] || '';
  // identifiers: word tokens
  const idRe = /\b([A-Za-z_]\w*)\b/g;
  const reserved = new Set([
    'if','else','for','while','return','in','out','inout','void','bool','int','float',
    'vec2','vec3','vec4','mat2','mat3','mat4','sampler2D','samplerCube','true','false',
    'discard','struct','const','precision','mediump','highp','lowp','do','break','continue',
    'attribute','uniform','varying','texture2D','mix','clamp','length','abs','dot','cross',
    'normalize','pow','sin','cos','tan','sqrt','max','min','floor','ceil','fract','mod',
    'sign','step','smoothstep','radians','degrees','exp','log','exp2','log2','inversesqrt',
    'matNRGONE','flatMVP','gl_FragCoord','gl_FrontFacing','gl_PointCoord','gl_VertexID',
  ]);
  let bad=[];
  while ((mm = idRe.exec(body))){
    const w = mm[1];
    if (reserved.has(w)) continue;
    if (declared.has(w)) continue;
    // function names we define are also declared in same shader; check whole src
    if (new RegExp('\\b'+w+'\\s*\\(').test(src)) continue; // it's a function
    bad.push(w);
  }
  const uniq = Array.from(new Set(bad));
  if (uniq.length){
    errors++;
    console.log('['+name+'] UNDECLARED identifiers:', uniq.join(', '));
    console.log('  source salt:', src.split(':')[0].slice(0,40));
  } else {
    console.log('['+name+'] OK');
  }
}
console.log(errors ? ('FAIL: '+errors+' shader(s) with undeclared identifiers') : 'ALL SHADERS OK');
process.exit(errors?1:0);