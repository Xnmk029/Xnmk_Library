// ============================================================================
//  R O O F T O P   R A I N
//  a jazz-infused chillhop tune for the strudel.cc live-coding environment
// ----------------------------------------------------------------------------
//  HOW TO PLAY
//    1. open https://strudel.cc (or use the ready-made link in the README,
//       which loads this exact code into the editor automatically)
//    2. press the play button, or hit ctrl+enter
//    (browsers refuse to make sound before one click/keypress, so "plays
//     automatically" always means: the code loads itself, you press play once)
//
//  WHAT YOU SHOULD HEAR
//    a 52-bar arrangement (about 2:40 at 78 bpm) that loops forever:
//    intro -> verse -> verse -> hook -> verse -> breakdown -> hook -> outro
//
//  Built with the vocabulary taught in the official strudel workshop
//  (https://strudel.cc/workshop/getting-started/): mini-notation, drum
//  banks, chord voicings, signal modulators, arrange() and the fx chain.
// ============================================================================

setcpm(78/4) // 78 bpm in 4/4 time: one cycle = one bar

// ----------------------------------------------------------------------------
// 1. HARMONY - two four-bar phrases that share one turnaround
//
//      A (verse): | Dm9   | G13   | Cmaj9 | A7b9  |
//      B (hook):  | Fmaj9 | E7b9  | Am11  | A7b9  |
//
//    A is a ii-V-I in C major (Dm9 -> G13 -> Cmaj9) whose fourth bar is a
//    secondary dominant, V7b9 of ii, so every phrase gets pulled back to its
//    own beginning - that pull is the engine of the loop. The hook opens with
//    a deceptive resolution: A7b9 "promises" Dm9, but Fmaj9 arrives instead -
//    and since Fmaj9 contains every note of Dm7, the ear is deceived and
//    satisfied at the same time. E7b9 -> Am11 is a real V-i into the relative
//    minor, and Am11 -> A7b9 flips one root from minor to dominant, sliding
//    the inner voices chromatically (C -> C#, B -> Bb).
//    Symbols are iReal-style (^9 = maj9); .voicing() renders them with
//    automatic smooth voice leading in a warm mid register.
// ----------------------------------------------------------------------------
const chordsA = chord("<Dm9 G13 C^9 A7b9>")
const chordsB = chord("<F^9 E7b9 Am11 A7b9>")

// ----------------------------------------------------------------------------
// 2. INSTRUMENTS - each layer is a small pattern (or pattern function),
//    so the sections below can remix them like channels on a mixing desk
// ----------------------------------------------------------------------------

// Rhodes comping on an eighth-note grid. Bar one: a fat dotted hit on the
// downbeat, a push on the "and of 2", and an anticipation on the "and of 4"
// that leans into the NEXT chord - jazz comping 101. Bar two answers off
// the beat. Velocity and filter drift so no two hits are identical.
const rhodes = (ch) => ch
  .struct("<[x@3 x ~ ~ ~ x] [~ x@3 ~ ~ x@2]>")
  .voicing()
  .s("gm_epiano1")
  .velocity(perlin.range(.55, .8))
  .lpf(sine.slow(21).range(1200, 2400))
  .hpf(180).release(.4).room(.35).pan(.45).gain(.6)

// Upright bass: root on the downbeat, a chord tone mid-bar, and a chromatic
// approach note on the "and of 4" walking into every next chord -
//   A section: f#1 -> g (below), b1 -> c (below), bb1 -> a (above), eb2 -> d
//   B section: f1 -> e (above), g#1 -> a (below), then plain fifths/sevenths
const bassA = note(`<[d2@2 [~ d2] [~ f#1]] [g1@2 [~ g1] [~ b1]]
                     [c2@2 [~ g1] [~ bb1]] [a1@2 [~ g1] [~ eb2]]>`)
const bassB = note(`<[f1@2 [~ c2] [~ f1]] [e1@2 [~ e1] [~ g#1]]
                     [a1@2 [~ e1] [~ g1]] [a1@2 [~ g1] [~ e1]]>`)
const upright = (line) => line
  .s("gm_acoustic_bass")
  .clip(.95).release(.06)
  .velocity(perlin.range(.7, .95))
  .lpf(950).shape(.25).gain(.85)

// Boom-bap kit: LinnDrum kick and snare, 808 hats. The kick sits on beat 1
// and the "and of 3" and is pitched a touch low; every 4th bar earns a
// 16th-note pickup fill. The snare backbeat drags ~25ms behind the grid -
// that lazy lo-fi lean - and a rimshot ghost sneaks in before each loop.
const kick = s(`<[bd ~ [~ ~ bd ~] ~]!3
                 [bd [~ ~ ~ bd] [~ ~ bd ~] [~ ~ ~ bd]]>`)
  .bank("AkaiLinn").speed(.9).shape(.3).gain(.95)

const snare = s("~ sd ~ sd").bank("AkaiLinn")
  .late(.008)
  .shape(.2).room(.25).gain(.72)

const ghost = s("<~ ~ ~ [~ ~ ~ [~ ~ ~ rim]]>")
  .hpf(500).room(.3).gain(.45).pan(.35)

const hats = s("hh*8")
  .velocity("[.9 .55]*4")
  .gain(perlin.range(.32, .45))
  .sometimesBy(.12, x => x.ply(2))
  .degradeBy(.04)
  .bank("RolandTR808").hpf(4000).pan(.42)

const ohat = s("<~ [~ ~ ~ [~ oh]]>")
  .bank("RolandTR808").clip(.35).hpf(4000).gain(.4).pan(.58)

const drums     = stack(kick, snare, ghost, hats, ohat)
const drumsBusy = stack(kick, snare, ghost, hats.sometimesBy(.25, x => x.ply(2)), ohat)

// Vibraphone lead - one written 8-bar statement over the hook changes.
// The signature gesture is a flat nine sighing onto its root: Bb -> A over
// A7b9 (bar 4), echoed as F -> E over E7b9 (bar 6). Phrase one climbs F's
// arpeggio so that its maj7 (E) lands across the barline as the root of
// E7b9; phrase two answers higher and settles on E - the 5th of A7 that
// becomes the 9th of the Dm9 waiting on the far side. Rests are melody too.
const vibes = note(`<
  [~ ~ [~ a4] [c5 ~]]
  [e5@2 [d5 ~] [b4 ~]]
  [a4@3 [~ g4]]
  [[bb4 a4] ~ [g4 ~] [e4 c#4]]
  [d4@2 ~ [a4 c5]]
  [[f5 e5] ~ [d5 ~] [b4 ~]]
  [c5@2 [b4 a4] ~]
  [~ [~ g4] e4@2]
>`)
  .s("gm_vibraphone")
  .clip(1.5)
  .velocity(perlin.range(.55, .8))
  .delay(".35:.58:.45")
  .room(.5).pan(.6).gain(.5)

// Ear candy: a music box dripping C-major-pentatonic tones, thinned out by
// chance so no two passes repeat, drifting across the stereo field with a
// pinch of bitcrush dust.
const sprinkle = note("<e6 ~ g5 a5 ~ d6 c6 ~>*2")
  .degradeBy(.35)
  .s("gm_music_box")
  .velocity(perlin.range(.4, .7))
  .delay(".4:.29:.5").room(.6).hpf(600)
  .crush(9)
  .pan(sine.slow(13).range(.25, .75))
  .gain(.38)

// ----------------------------------------------------------------------------
// 3. SECTIONS - the same handful of layers, recombined like a real record:
//    add a layer to build, take the floor away to breathe
// ----------------------------------------------------------------------------
const intro = stack(
  rhodes(chordsA).room(.55).size(5).gain(.5),
  sprinkle,
)

const verse  = stack(drums, upright(bassA), rhodes(chordsA))
const verse2 = stack(drums, upright(bassA), rhodes(chordsA), sprinkle)
const hook   = stack(drums, upright(bassB), rhodes(chordsB), vibes)
const verse3 = stack(drumsBusy, upright(bassA), rhodes(chordsA), sprinkle)

const breakdown = stack(
  rhodes(chordsB).room(.75).size(6).lpf(1400).gain(.55),
  upright(note("<f1 e1 a1 a1>")).lpf(700).gain(.7),
  hats.degradeBy(.35).gain(.25),
  sprinkle,
)

const outro = stack(
  rhodes(chordsA)
    .lpf(isaw.slow(4).range(350, 2200))
    .room(saw.slow(4).range(.35, .8))
    .gain(isaw.slow(4).range(.15, .6)),
  upright(bassA).gain(isaw.slow(4).range(0, .85)),
  sprinkle,
)

// ----------------------------------------------------------------------------
// 4. THE SONG - 52 bars, ~2:40, then it loops. One swingBy() on the master
//    output drags every offbeat in the whole band together, like one MPC
//    swing knob over the entire session.
// ----------------------------------------------------------------------------
$: arrange(
  [4, intro],      // keys and dust set the scene
  [8, verse],      // the beat drops
  [8, verse2],     // music box joins
  [8, hook],       // B changes: the vibraphone says the theme
  [8, verse3],     // hats get restless
  [4, breakdown],  // the floor disappears
  [8, hook],       // the theme gets the last word
  [4, outro],      // the filter closes, back to the rain
).swingBy(.2, 4)

// vinyl crackle runs beneath everything, even the quiet edges -
// the lo-fi picture frame around the whole tune
$: s("crackle*4").density(.05).gain(.45)
