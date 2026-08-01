// ============================================================
//  Techno — "Neon District"  (G minor, 128 BPM)
//  一首催眠式 Techno: 909 鼓机 + Acid 贝斯 + Offbeat Stab
//  使用: 打开 https://strudel.cc -> 粘贴全部代码 -> Ctrl+Enter
//  8 小节循环: 极简开头 -> 贝斯进入 -> 和弦进入 -> Arp + Riser
// ============================================================

setcpm(128 / 4); // 128 BPM 的 4/4 拍

// ---------- 和声: i9 与 bVI9 交替 (4 小节一组) ----------
// Gm9 | Gm9 | EbM9 | EbM9
let chords = chord(`<Gm9 Gm9 EbM9 EbM9>`);

// 段落闸门 (8 小节)
const bassIn = "<0 0 1 1 1 1 1 1>";
const stabIn = "<0 0 0 0 1 1 1 1>";
const padIn = stabIn;
const arpIn = "<0 0 0 0 0 0 1 1>";
const riserIn = "<0 0 0 0 0 0 0 1>";

// ---------- 1. 909 Kick: 四踩底鼓 (第 8 小节 16 分音符 Fill) ----------
$: s(`<[bd ~ bd ~ bd ~ bd ~]
      [bd ~ bd ~ bd ~ bd ~]
      [bd ~ bd ~ bd ~ bd ~]
      [bd ~ bd ~ bd ~ bd ~]
      [bd ~ bd ~ bd ~ bd ~]
      [bd ~ bd ~ bd ~ bd ~]
      [bd ~ bd ~ bd ~ bd ~]
      [[bd bd] ~ bd ~ [bd bd] ~ bd ~]>`)
  .bank("RolandTR909").gain(".85").orbit(1);

// ---------- 2. 16 分 Hi-hat (重音在第 1、3 拍) ----------
$: s("hh*16").bank("RolandTR909")
  .gain(".28").hpf(7500).pan(".4")
  .velocity("<1 .35 .6 .35 .8 .4 .6 .35 1 .35 .6 .35 .8 .4 .6 .4>")
  .cut(1).orbit(1);

// ---------- 3. Open Hat (隔小节落在 4 拍后半拍) ----------
$: s(`<[~ ~ ~ ~ ~ ~ ~ oh]
      [~ ~ ~ ~ ~ ~ ~ ~]>`).bank("RolandTR909")
  .gain(".28").pan(".45").cut(1).orbit(1);

// ---------- 4. Clap: 2、4 拍 + 第 8 小节滚奏 Fill ----------
$: s(`<[~ ~ cp ~ ~ ~ cp ~]
      [~ ~ cp ~ ~ ~ cp ~]
      [~ ~ cp ~ ~ ~ cp ~]
      [~ ~ cp ~ [cp cp] ~ cp ~]>`)
  .bank("RolandTR909").gain(".4").room(".25").pan(".52")
  .rarely(n => n.ply(2))
  .mask(bassIn).orbit(1);

// ---------- 5. Shaker (Euclid 节奏 5/16) ----------
$: s("sh(5,16,3)").gain(".12").hpf(7000).pan(".62")
  .mask("<0 0 0 1 1 1 1 1>").orbit(1);

// ---------- 6. Acid 贝斯 (G 小调五声 + 滤波器扫频) ----------
$: note(`<[g1 ~ g1 [g1 bb1] ~ g1 ~ ~ c2 ~ bb1 ~ g1 [bb1 g1] ~ ~]
          [~ bb1 ~ c2 [bb1 ~] g1 ~ bb1 ~ ~ c2 ~ [g1 bb1] ~ g1 ~]
          [eb2 ~ eb2 [eb2 f2] ~ g2 ~ ~ bb2 ~ g2 ~ eb2 [f2 g2] ~ ~]
          [~ f2 ~ g2 [f2 ~] eb2 ~ bb2 ~ ~ g2 ~ [eb2 f2] ~ eb2 ~]>`)
  .s("sawtooth")
  .clip(".8").adsr(".005:.18:.3:.06")
  .lpf(sine.range(220, 2600).slow(4)).lpq(14)
  .lpenv(3.5).lpa(".004").lpd(".14").lps(".08")
  .penv(-2).patt(".004").pdec(".08")
  .gain(".42").room(".18").orbit(2)
  .mask(bassIn);

// ---------- 7. Offbeat 和弦 Stab (sawtooth, 反拍切入) ----------
$: chords
  .anchor("g4").voicing()
  .s("sawtooth")
  .struct("~ x ~ x ~ x ~ x")
  .gain(".16").adsr(".005:.1:.3:.05").clip(".6")
  .lpf(1500).lpq(2)
  .room(".3").delay(".18").pan(".5")
  .juxBy(".25", rev)
  .orbit(3).mask(stabIn);

// ---------- 8. 暗色三角波 Pad ----------
$: chords
  .anchor("g3").mode("duck").voicing()
  .s("triangle")
  .clip(2).adsr(".3:.4:.5:.8")
  .gain("<0 0 0 0 .12 .12 .16 .16>")
  .lpf(1100).room(".45").orbit(5)
  .mask(padIn);

// ---------- 9. 催眠 Arp (G 小调音阶, palindrome 反向) ----------
$: n("<0 2 3 7 10 12 10 7>")
  .scale("g3:minor")
  .s("square")
  .gain(".13").decay(".18").sustain(0).release(".05")
  .lpf(3600)
  .room(".35").delay(".3")
  .pan(sine.range(0.2, 0.8).segment(8))
  .palindrome()
  .orbit(4).mask(arpIn);

// ---------- 10. 白噪 Riser (第 8 小节上扬, 落回第 1 小节) ----------
$: s("white")
  .gain("<0 .12 .2 .3>").lpf("<400 900 1800 3600>").hpf(200)
  .clip(1).attack(".05").release(".05")
  .pan(".5").orbit(6)
  .mask(riserIn);
