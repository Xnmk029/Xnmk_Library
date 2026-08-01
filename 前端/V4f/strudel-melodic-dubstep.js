// ============================================================
//  Glass Horizon — Melodic Dubstep @ 140 BPM
//  调性: F 小调  |  和弦进行: Fm – Db – Ab – Eb  (i–VI–III–VII)
//  曲式(64 小节, 约 1:50, 循环播放):
//  Intro 8 | Build 8 | Drop A 16 | Breakdown 8 | Build 2 8 | Drop B 16
//  注意: Strudel 会把"双引号"字符串自动当作 mini notation 解析,
//        所以辅助函数里的纯 JS 字符串必须用单引号!
// ============================================================

setcpm(140 / 4); // 140 BPM：每 cycle = 一小节 4/4（setcpm(bpm/bpc)）

// ---------- 曲式辅助函数 ----------
const TOTAL = 64;

// 小节开关: barMask([起始小节, 长度], ...)
const barMask = (...ranges) => {
  const a = Array(TOTAL).fill(0);
  for (const [s, len] of ranges)
    for (let i = s; i < s + len; i++) a[i] = 1;
  return '<' + a.join(' ') + '>';
};

// 音量自动化: volLane([起始小节, 长度, 音量], ...)
const volLane = (...ranges) => {
  const a = Array(TOTAL).fill(0);
  for (const [s, len, v] of ranges)
    for (let i = s; i < s + len; i++) a[i] = v;
  return '<' + a.join(' ') + '>';
};

// ---------- 和声素材 ----------
const padChords = chord("<Fm9 DbM9 AbM9 Eb9>"); // 铺底: 加 9 音的柔和小调色彩
const stabChords = chord("<Fm Db Ab Eb>");      // 副歌刺音: 干净三和弦

// ---------- 鼓组 (half-time 140) ----------
const drums = stack(
  // 主 kick: 第 1 拍 + 第 3 拍后半拍
  s("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~").bank("RolandTR909").gain(.92).clip(.85)
    .mask(barMask([4, 4], [16, 16], [48, 16])),
  // 脉冲 kick (build / breakdown)
  s("bd").bank("RolandTR909").gain(.78).clip(.85)
    .mask(barMask([8, 8], [32, 8], [40, 8])),
  // 铺垫段渐强 kick
  s("bd*8").bank("RolandTR909").gain(.5).clip(.7)
    .mask(barMask([12, 3], [44, 3])),
  s("bd*16").bank("RolandTR909").gain(.55).clip(.7)
    .mask(barMask([15, 1], [47, 1])),
  // snare + clap 在第 3 拍
  s("~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~").bank("RolandTR909").gain(.85).room(.25)
    .mask(barMask([8, 8], [16, 16], [40, 8], [48, 16])),
  s("~ ~ ~ ~ ~ ~ ~ ~ cp ~ ~ ~ ~ ~ ~ ~").bank("RolandTR909").gain(.32)
    .mask(barMask([8, 8], [16, 16], [40, 8], [48, 16])),
  // ghost snare (Drop B 才出现的变化)
  s("~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~").bank("RolandTR909").gain(.5)
    .mask(barMask([48, 16])),
  // 进 Drop 的 snare roll
  s("sd*8").bank("RolandTR909").gain(.42).lpf(2500)
    .mask(barMask([14, 1], [46, 1])),
  s("sd*16").bank("RolandTR909").gain(.5).lpf(9000)
    .mask(barMask([15, 1], [47, 1])),
  // 16 分 hi-hat, 带力度 accent
  s("hh*16").bank("RolandTR808").n("<0 1 2 3>*4")
    .gain("1 .4 .62 .4 1 .4 .62 .4 1 .4 .62 .4 1 .4 .62 .4")
    .velocity(volLane([1, 7, .28], [8, 8, .42], [16, 16, .5], [32, 8, .2], [40, 8, .42], [48, 16, .5])),
  // 小节末 open hat (与 closed hat 同 cut 组)
  s("~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ oh").bank("RolandTR808").cut(1).gain(.4)
    .mask(barMask([8, 8], [16, 16], [40, 8], [48, 16])),
  // 8 分 shaker
  s("sh*8").gain(.2).hpf(5000)
    .mask(barMask([8, 8], [16, 16], [40, 8], [48, 16])),
  // 欧几里得 rim 节奏 (Build 2 + Drop B)
  s("rim(3,8,2)").gain(.28).room(.15).mask(barMask([40, 24])),
  // tambourine
  s("tb*4").gain(.16).mask(barMask([8, 8], [40, 8]))
).compressor("-18:8:6:.002:.04").postgain(1.05);

// ---------- 铺底 pad (supersaw + 9 和弦) ----------
const pads = padChords.anchor("f4").voicing()
  .s("supersaw").spread(.9).detune(.25).unison(7)
  .attack(.9).decay(.2).sustain(.8).release(1.2)
  .lpf(1500).lpq(2).phaser(2)
  .gain(volLane([0, 8, .3], [8, 8, .25], [16, 16, .14], [32, 8, .32], [40, 8, .25], [48, 16, .16]))
  .orbit(2).room(.6).roomsize(5);

// ---------- Drop 和弦刺音 (第 2 拍后半 + 第 4 拍后半) ----------
const stabs = stabChords
  .struct("~ ~ ~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~ x ~")
  .voicing()
  .s("sawtooth")
  .attack(.002).decay(.14).sustain(0).release(.06)
  .lpf(2600).lpq(4)
  .gain(volLane([16, 16, .38], [48, 16, .42]))
  .orbit(2).room(.3).roomsize(2);

// ---------- Sub bass (跟和弦根音) ----------
const sub = note("<f1 db1 ab1 eb1>")
  .s("sine")
  .attack(.004).decay(.06).sustain(.9).release(.12)
  .clip(1)
  .gain(volLane([8, 8, .4], [16, 16, .6], [32, 8, .3], [40, 8, .4], [48, 16, .6]))
  .orbit(4).room(.1).roomsize(1);

// ---------- Wobble / Reese bass ----------
const wobbleA = note("<f2 db2 ab2 eb2>")
  .s("supersaw").spread(1).detune(.45).unison(7)
  .seg(16)                                  // 每 16 分采样一次, 让滤波 LFO 连续
  .lpf(tri.range(120, 1700).fast(4)).lpq(10).ftype("24db")
  .vowel("<a e i o>*4")                     // 元音共振峰扫频
  .shape(.3)
  .attack(.004).decay(.12).sustain(.85).release(.06)
  .gain(volLane([16, 16, .48]))
  .orbit(4).room(.12).roomsize(1);

const wobbleB = note("<f2 db2 ab2 eb2>")
  .s("supersaw").spread(1).detune(.55).unison(7)
  .seg(16)
  .lpf(sine.range(100, 2100).fast(8)).lpq(8).ftype("24db")
  .vowel("<i a e o>*4")
  .shape(.4)
  .attack(.004).decay(.1).sustain(.85).release(.06)
  .gain(volLane([48, 16, .5]))
  .orbit(4).room(.12).roomsize(1);

// ---------- Drop B 的根音刺音 ----------
const bassStabs = note("<f3 db3 ab3 eb3>")
  .struct("x ~ ~ ~ ~ ~ x ~ ~ ~ ~ ~ ~ ~ ~ ~")
  .s("sawtooth")
  .attack(.002).decay(.2).sustain(0).release(.05)
  .lpf(1400).lpq(4)
  .gain(volLane([48, 16, .36]))
  .orbit(4).room(.1).roomsize(1);

// ---------- 主音合成器 (supersaw lead) ----------
const makeLead = (melody, vol, oct = 0) =>
  melody.transpose(oct)
    .s("supersaw").spread(.8).detune(.3).unison(7)
    .attack(.01).decay(.12).sustain(.75).release(.22)
    .lpf(sine.range(1800, 6800).slow(8)).lpq(5)
    .vib("5:.05")
    .delay(.26).delaysync(.1875).delayfeedback(.32)
    .gain(vol)
    .orbit(3).room(.35).roomsize(2);

// 主题 A (Drop A): 8 小节, 以和弦音为主, 声部进行平滑
const leadMelodyA = note(`
<[c5 ~ ab4 ~ f4 ~ g4 ~]
 [ab4 ~ c5 ~ db5 ~ ~ ~]
 [eb5 ~ c5 ~ ab4 ~ c5 ~]
 [eb5 ~ db5 ~ c5 ~ ~ ~]
 [f5 ~ eb5 ~ c5 ~ db5 ~]
 [c5 ~ ab4 ~ c5 ~ db5 ~]
 [eb5 ~ g5 ~ f5 ~ eb5 ~]
 [eb5 ~ db5 ~ c5 ~ ~ ~]>
`);

const leadA = stack(
  makeLead(leadMelodyA, volLane([16, 16, .32])),
  makeLead(leadMelodyA, volLane([16, 16, .12]), 12) // +1 八度垫层
);

// 主题 B (Drop B): 更密集的 16 分跑动
const leadMelodyB = note(`
<[c5 eb5 f5 g5 ab5 ~ g5 f5]
 [ab5 ~ c5 db5 ~ c5 ab4 c5]
 [eb5 c5 ab4 c5 eb5 ~ c5 eb5]
 [eb5 db5 c5 db5 eb5 ~ ~ ~]
 [f5 g5 ab5 g5 f5 eb5 c5 db5]
 [c5 db5 c5 ab4 ~ c5 db5 c5]
 [eb5 g5 eb5 f5 g5 f5 eb5 c5]
 [eb5 db5 c5 ~ db5 ~ c5 ~]>
`);

const leadB = stack(
  makeLead(leadMelodyB, volLane([48, 16, .34])),
  makeLead(leadMelodyB, volLane([48, 16, .13]), 12)
);

// ---------- 拨弦 arpeggio (跟随 9 和弦) ----------
const arp = n("<0 1 2 3 4 3 2 1>*2")
  .set(padChords)
  .anchor("f4")
  .voicing()
  .s("triangle")
  .attack(.002).decay(.16).sustain(0).release(.05)
  .lpf(3400).lpq(1)
  .delay(.2).delaysync(.1875).delayfeedback(.3)
  .gain(volLane([8, 8, .24], [32, 8, .22], [40, 8, .24], [48, 16, .2]))
  .orbit(3).room(.3).roomsize(2);

// ---------- 钢琴主题 (Intro 与 Breakdown) ----------
const piano = note(`
<[f4 ~ ab4 ~ c5 ~ ~ ~]
 [ab4 ~ c5 ~ db5 ~ ~ ~]
 [eb5 ~ c5 ~ ab4 ~ c5 ~]
 [eb5 ~ db5 ~ c5 ~ ~ ~]
 [f5 ~ eb5 ~ c5 ~ db5 ~]
 [c5 ~ ab4 ~ c5 ~ db5 ~]
 [eb5 ~ g4 ~ f4 ~ eb4 ~]
 [eb4 ~ db4 ~ c4 ~ ~ ~]>
`)
  .s("piano").clip(1)
  .delay(.3).delaysync(.375).delayfeedback(.35)
  .gain(volLane([0, 8, .34], [32, 8, .34]))
  .orbit(2).room(.5).roomsize(3);

// ---------- FX: riser / impact ----------
const riser1 = s("white")
  .seg(64)
  .gain(saw.range(0, .5).slow(3).late(13))
  .hpf(saw.range(300, 8000).slow(3).late(13))
  .attack(.005).release(.05)
  .mask(barMask([13, 3]))
  .orbit(5);

const riser2 = s("white")
  .seg(64)
  .gain(saw.range(0, .5).slow(3).late(45))
  .hpf(saw.range(300, 8000).slow(3).late(45))
  .attack(.005).release(.05)
  .mask(barMask([45, 3]))
  .orbit(5);

const impact = stack(
  s("cr").gain(volLane([16, 1, .55], [32, 1, .4], [48, 1, .55])).decay(.7).sustain(0),
  s("white").gain(volLane([16, 1, .45], [32, 1, .3], [48, 1, .45])).attack(.001).decay(.5).sustain(0).hpf(300).lpf(5000),
  note("f1").s("sine").penv(-12).pdec(.45).pcurve(1).gain(volLane([16, 1, .85], [32, 1, .5], [48, 1, .85]))
).orbit(5);

// ---------- 总轨 ----------
stack(
  drums,
  pads,
  stabs,
  sub,
  wobbleA,
  wobbleB,
  bassStabs,
  leadA,
  leadB,
  arp,
  piano,
  riser1,
  riser2,
  impact
);
