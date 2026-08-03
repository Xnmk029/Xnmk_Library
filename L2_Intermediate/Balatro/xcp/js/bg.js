/* 旋涡油彩背景 —— 原创 WebGL 片元着色器实现 */
(function () {
  window.setBgTheme = function () {};
  const canvas = document.getElementById('bg');
  const gl = canvas.getContext('webgl', { antialias: false });
  if (!gl) { document.body.classList.add('no-webgl'); return; }

  const VSH = `
attribute vec2 p;
void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

  const FSH = `
precision highp float;
uniform vec2 u_res;
uniform float u_t;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  float t = u_t * 0.10;

  float r = length(uv);
  float a = atan(uv.y, uv.x) + 2.4 * r - t * 1.2;
  vec2 q = vec2(cos(a), sin(a)) * r * 2.4;

  for (int i = 1; i <= 4; i++) {
    float fi = float(i);
    q += (0.42 / fi) * vec2(
      cos(fi * 1.6 * q.y + t * 2.1 + fi * 1.7),
      sin(fi * 1.5 * q.x - t * 1.6 + fi * 0.9)
    );
  }

  float v = sin(q.x * 1.4) + cos(q.y * 1.2);
  float band = (v + 2.0) * 0.25;

  vec3 col = u_c1;
  col = mix(col, u_c2, smoothstep(0.30, 0.36, band));
  col = mix(col, u_c3, smoothstep(0.62, 0.68, band));

  col *= 1.0 - 0.5 * dot(uv, uv);
  gl_FragColor = vec4(col, 1.0);
}`;

  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VSH));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FSH));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'u_res');
  const uT = gl.getUniformLocation(prog, 'u_t');
  const uC1 = gl.getUniformLocation(prog, 'u_c1');
  const uC2 = gl.getUniformLocation(prog, 'u_c2');
  const uC3 = gl.getUniformLocation(prog, 'u_c3');

  /* 主题色：绿色牌桌 / 红色主菜单 */
  const THEMES = {
    green: [[0.055, 0.145, 0.110], [0.085, 0.205, 0.150], [0.125, 0.270, 0.195]],
    red:   [[0.180, 0.055, 0.070], [0.290, 0.085, 0.095], [0.420, 0.130, 0.110]],
    blue:  [[0.050, 0.090, 0.180], [0.075, 0.135, 0.260], [0.110, 0.190, 0.340]],
  };
  let cur = THEMES.red.map(c => c.slice());
  let target = THEMES.red;

  window.setBgTheme = function (name) { if (THEMES[name]) target = THEMES[name]; };

  function resize() {
    const s = 0.4; /* 低分辨率渲染，油彩颗粒感 */
    canvas.width = Math.max(2, innerWidth * s | 0);
    canvas.height = Math.max(2, innerHeight * s | 0);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  addEventListener('resize', resize);
  resize();

  const t0 = performance.now();
  (function frame(now) {
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        cur[i][j] += (target[i][j] - cur[i][j]) * 0.03;
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uT, (now - t0) / 1000);
    gl.uniform3fv(uC1, cur[0]);
    gl.uniform3fv(uC2, cur[1]);
    gl.uniform3fv(uC3, cur[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  })(t0);
})();
