// ============================================================
//  Jazz Chillhop — "Rainy Window"  (F minor, 74 BPM)
//  一首融合说唱 beat 骨架的爵士 chillhop / lo-fi 作品
//  使用: 打开 https://strudel.cc -> 粘贴全部代码 -> Ctrl+Enter
//  播放后按 8 小节循环自动进行 (4 小节引子 + 4 小节主段)
// ============================================================

setcpm(74 / 4); // Strudel: 1 cycle = 1 小节, setcpm(bpm/4) 才是 bpm

// ---------- 和声: i9 - bVI9 - bIII9 - bVII9 - v9 ----------
// Fm9 | Fm9 | DbM9 | DbM9 | AbM9 | AbM9 | EbM9 | Cm9
let chords = chord(`<Fm9 Fm9 DbM9 DbM9 AbM9 AbM9 EbM9 Cm9>`);

// 主段闸门: 前 4 小节只留钢琴/垫底，后 4 小节进完整编曲
const groove = "<0 0 0 0 1 1 1 1>";

// 8 小节的表情自动化 (钢琴与垫底随段落打开)
const compGain = "<.20 .26 .32 .38 .44 .42 .38 .34>";
const compLpf = "<420 620 1000 1600 2400 2400 2200 1800>";
const padGain = "<.07 .09 .11 .13 .15 .14 .12 .11>";

// ---------- 1. 黑胶颗粒 (Lo-Fi 底噪) ----------
$: s("crackle*32")
  .density(".06").gain(".12")
  .hpf(3000).lpf(9000)
  .pan(sine.range(0.35, 0.65).slow(8))
  .orbit(5);

// ---------- 2. Rhodes 和弦 (爵士 voicing 自动声部连接) ----------
$: chords
  .anchor("c4").voicing()
  .s("gm_epiano1:1")
  .struct("x [~ x] x ~") // 第1拍、第2拍后半拍、第3拍的 comping
  .velocity("<.85 .7 .8 .65>")
  .gain(compGain)
  .lpf(compLpf).lpq(3)
  .phaser(3)
  .room(".35").delay(".18").orbit(3)
  .late(rand.range(0, 0.028)); // 微小的人性化偏移

// ---------- 3. 温暖正弦垫底 ----------
$: chords
  .anchor("f3").mode("duck").voicing()
  .s("sine")
  .clip(1.5).adsr(".35:.3:.5:.9")
  .gain(padGain).lpf(1400)
  .room(".45").orbit(6);

// ---------- 4. 贝斯 (根音 + 5度 + b7 的级进走向) ----------
$: n(`<[0 ~ ~ ~ 0 ~ ~ ~]
      [0 ~ ~ ~ 0 ~ 2 ~]
      [0 ~ 2 ~ 0 ~ 3 ~]
      [0 ~ ~ ~ 0 ~ 2 ~]>`)
  .set(chords).mode("root:f2").voicing()
  .s("gm_acoustic_bass")
  .gain(".55").lpf(800).lpq(3)
  .room(".18").orbit(2)
  .compressor("-22:8:4:.003:.04")
  .late(rand.range(0, 0.02))
  .mask(groove);

// ---------- 5. Boom-Bap 鼓组 (TR-808) ----------
$: stack(
  s(`<[bd ~ ~ ~ bd ~ ~ ~]
      [bd ~ ~ ~ bd ~ ~ ~]
      [bd ~ ~ ~ bd ~ ~ ~]
      [bd ~ ~ ~ [bd bd] ~ ~ ~]>`).bank("RolandTR808").gain(".8"),
  s(`<[~ ~ rim ~ ~ ~ rim ~]
      [~ ~ rim ~ ~ ~ rim ~]
      [~ ~ rim ~ ~ ~ rim ~]
      [~ ~ [rim rim] ~ ~ ~ [rim rim] ~]>`).bank("RolandTR808").gain(".45").room(".28").pan(".52"),
  s(`<[hh hh hh hh hh hh hh hh]
      [hh hh hh hh hh hh hh hh]
      [hh hh hh hh hh hh hh hh]
      [hh hh]*4>`).bank("RolandTR808")
    .gain(".35").hpf(6500).pan(".38")
    .swingBy(0.32, 4)
    .velocity(sine.range(0.3, 0.75).segment(8))
    .rarely(n => n.ply(2)),
  s(`<[~ ~ ~ ~ ~ ~ ~ oh]
      [~ ~ ~ ~ ~ ~ ~ ~]
      [~ ~ ~ ~ ~ ~ ~ oh]
      [~ ~ ~ ~ ~ ~ ~ ~]>`).bank("RolandTR808").gain(".3").pan(".42"),
  s("sh(3,8,2)").gain(".14").hpf(6000).pan(".62")
)
  .mask(groove)
  .compressor("-16:10:5:.004:.05").postgain(1.1)
  .orbit(1);

// ---------- 6. 爵士吉他主旋律 (EbM9 到 Cm9 的级进线条) ----------
$: note(`<[~ ~ c5 ~ ~ ~ eb5 ~]
          [~ ~ ~ f5 [eb5 ~] ~ [c5 ~] ~]
          [~ g5 ~ f5 ~ [eb5 d5] ~ ~]
          [~ ~ c5 ~ [d5 ~] ~ [bb4 c5] ~]>`)
  .s("gm_electric_guitar_jazz")
  .gain(".28").clip(1)
  .penv("1").patt(".03").pdec(".2")
  .vib("5:.06")
  .lpf(3500).phaser(2).delay(".22").room(".3")
  .pan(".58").orbit(4)
  .late(rand.range(0, 0.025))
  .mask(groove);

// ---------- 7. Casio 高音碎拨 (和弦内音点缀) ----------
$: n(`<[0,2] ~ ~ ~ [1,3] ~ ~ ~
      [0,2] ~ ~ [1,3] ~ ~ ~ ~
      [0,2] ~ [1,3] ~ ~ ~ ~ ~
      [0,2] ~ ~ [1,3] ~ ~ ~ ~>`)
  .set(chords).mode("root:f4").voicing()
  .s("casio")
  .clip(".45").decay(".12").sustain(0)
  .gain(".12").room(".25").delay(".2")
  .pan(".42").orbit(7)
  .late(rand.range(0, 0.02))
  .mask(groove);
