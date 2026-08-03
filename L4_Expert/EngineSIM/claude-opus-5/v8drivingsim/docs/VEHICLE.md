# Vehicle dynamics: the single-track model

This documents `src/sim/` — the tyre model, the powertrain and the chassis. All
of it is plain JS with no three.js and no Web Audio imports, so it runs and is
tested under bare node (`npm test`).

---

## 1. Two-axle single-track ("bicycle") model

The brief asked for at least a bicycle model, which is what this is: the two
wheels of each axle are lumped into one, so there is no left/right load split,
no differential, and no four-wheel load transfer.

State — five chassis degrees of freedom plus one wheel speed per axle:

| symbol | meaning |
|---|---|
| `x, z` | world position |
| `yaw` | heading |
| `vx, vy` | body-frame velocity: forward, left |
| `r` | yaw rate |
| `omegaF, omegaR` | axle angular speeds |

Body-frame equations of motion, with the centripetal terms that a naive
implementation forgets:

```
m (v̇x − vy·r) = ΣFx
m (v̇y + vx·r) = ΣFy
Izz · ṙ        = a·Fy_front − b·Fy_rear
```

Slip angles, with the front wheel's velocity resolved along its steered heading:

```
αf = δ − atan2(vy + a·r, vx)
αr =   − atan2(vy − b·r, vx)
```

### Sign convention

Body axes are **x forward, y left, yaw positive counter-clockwise**. A positive
slip angle produces a positive (leftward) force; a positive slip ratio produces
a positive (forward) force.

This is chosen to line up exactly with three.js: `yaw = 0` points the car along
`+Z`, forward is `(sin ψ, cos ψ)`, left is `(cos ψ, −sin ψ)`, and therefore
`mesh.rotation.y = vehicle.yaw` with no conversion anywhere. There are tests
pinning the convention down (`tyre force signs follow the documented
convention`, `steering left yaws left and curves the path toward +X`) because
a single flipped sign here produces a car that steers the wrong way and is
surprisingly easy to talk yourself into believing is correct.

### Weight transfer

```
Fzf = m·g·b/L − m·ax·h/L + aero_front
Fzr = m·g·a/L + m·ax·h/L + aero_rear
```

`ax` is taken from the previous step — resolving it implicitly would need an
inner solve for no perceptible benefit at a 1 kHz step.

The car is a ~1950 kg front-mid-engine layout with a 52/48 static split. That
distribution is *why* it rotates willingly rather than understeering everywhere;
a conventional front-engine car of the same mass would be nearer 56/44.

---

## 2. Tyres: Magic Formula with similarity combined slip

```
F(s) = D · sin( C · atan( B·s − E·(B·s − atan(B·s)) ) )
```

This gives the shape every real tyre has: linear at small slip, a rounded peak,
then a **falling** plateau. The falling part is the point — it is why a car snaps
once you are past the limit, and no linear tyre model can produce it.

### B is derived, not tuned

The formula peaks where `C·atan(g(B·s)) = π/2`, i.e. where `g(B·s) = tan(π/2C)`
with `g(u) = u − E(u − atan u)`. Since `g` is monotonic for `E < 1`, a bisection
at construction time solves for the `B` that places the peak exactly at the
configured `kappaPeak` / `alphaPeak`.

This matters. The first version hand-picked `bLat = 9.4` alongside
`alphaPeak = 0.155 rad`, and the curve actually peaked at **0.475 rad (27°)** —
so `alphaPeak` was decorative, lateral force still rose past 50° of slip, and the
tyre never fell away. Deriving `B` also makes the peak force exactly `μ·Fz`,
which is a property the Magic Formula is supposed to have and which the tests now
assert.

### Combined slip

The similarity method: normalise both slips by their peak locations, take the
magnitude, evaluate the formula once on that, then split the resulting force back
along the slip vector.

```
nx = κ / κ_peak
ny = tan(α) / α_peak
σ  = hypot(nx, ny)
Fx = F(σ) · nx/σ,   Fy = F(σ) · ny/σ
```

That produces a proper friction ellipse — you cannot brake and corner at full
capacity at the same time — for one extra `hypot`. Tested directly.

Also modelled: **load sensitivity** (μ falls as load rises, so grip per newton
drops on the heavily loaded outside tyre), **relaxation length** (lateral force
lags by a rolling *distance* rather than a time, which keeps it stable down to a
standstill), and rolling resistance.

Surface grip multipliers come from the track's `gripAt(x, z)`, sampled
independently under each axle — so two wheels on the grass while two are on
tarmac genuinely feels different.

---

## 3. Powertrain

`Engine` integrates one rotational degree of freedom: indicated torque from a
WOT torque curve scaled by throttle, minus friction and pumping losses, minus
whatever the clutch takes.

Things worth calling out, because each one was a bug first:

**The idle governor needs integral action.** A proportional-only governor sags
the moment anything asks for torque at idle and the engine dies. With integral
action it holds against creep load.

**The auto-clutch must have zero capacity below idle.** A cranking engine makes
less torque than a partially engaged clutch absorbs, so any non-zero floor
stalls the car on every single start. It also releases entirely when stopped
with the brake applied, the way an automatic's torque converter effectively does.

**Automatic shifts must be decided from road speed, not the tachometer.** During
a shift the clutch is open and the engine is free. Deciding from actual engine
speed means the free-revving engine instantly hits the upshift threshold, which
opens the clutch again — a deadlock that ran the gearbox from 2nd to 6th in half
a second while the car coasted. Every real TCU uses output-shaft speed for
exactly this reason. Throttle is also cut through the shift, which is both
correct and most of what a shift *sounds* like.

**The clutch coupling is semi-implicit.** A stiff viscous clutch is a stiff
spring between two small inertias, and an explicit step diverges when
`dt·k·(1/Ie + n²/Iw) > 2` — at 1 kHz in first gear that caps the stiffness
around 40 Nm per rad/s, far too soft. Backward Euler on the slip
(`slip' = slip / (1 + dt·k·invEff)`) is unconditionally stable at any stiffness
and asymptotes to the stiffest coupling the timestep can carry. Note that
`invEff` must use the **true** inertias: inflating it (by adding vehicle mass
reflected through the tyre, say) weakens the implicit term and the clutch
chatters between ±capacity instead of settling.

**Wheel speeds are integrated semi-implicitly too**, for the same reason. The
tyre's longitudinal slope `dFx/dκ` is folded into the denominator, which makes
the wheel/tyre loop unconditionally stable at 1 kHz rather than needing a 4 kHz
substep at low speed. Brake torque is clamped so it can stop a wheel but never
reverse it.

---

## 4. Integration and timestep

The chassis and powertrain run at a fixed **1 kHz**, substepped from the render
frame. The substep cap is 110, sized to cover the largest frame time the caller
delivers (`main.js` clamps to 100 ms) — so the simulation never silently runs in
slow motion on a weak GPU. It just costs more substeps.

The first version capped at 40 substeps and reset the accumulator, which meant
that at 14 fps the car experienced 40 ms of physics per 71 ms of real time.
Everything worked; it was simply in slow motion, which is exactly the kind of
bug that is invisible until you check a number.

---

## 5. What the numbers come out as

From `npm test`, all asserted rather than eyeballed:

| quantity | value |
|---|---|
| 0–100 km/h | 5.1 s (traction-limited off the line) |
| quarter mile | 13.1 s @ 183 km/h |
| top speed | 293 km/h, drag-limited in 5th |
| 100–0 km/h | 42 m — 0.94 g average, 1.04 g peak |
| peak lateral | 1.09 g |
| wheelspin off the line | peak rear slip 0.88 (TC off) vs 0.25 (TC on) |
| grass | >1.4× the stopping distance of asphalt |
| understeer | steady-state yaw rate below the kinematic value, as it must be |
| stability | 60 s of randomised abusive input with no non-finite state |

Braking is on the long side of a real Challenger's 35–37 m. That is the honest
consequence of μ ≈ 1.05 effective plus a fixed 65/35 brake bias: a single-track
model has one load per axle, so it cannot redistribute pressure the way four
independent wheels and a real EBD system do.

Two unit bugs were worth about 0.3 g between them, and both are the kind that
produce a car that merely feels *slightly* wrong:

- `fz0`, the load at which μ is quoted, was set to a per-**wheel** figure
  (4400 N) while the model hands each tyre a whole **axle** load (9–13 kN). Every
  normalised load was therefore 2–3× too large and load sensitivity ate grip
  that should have been there.
- Brake torque was 3900/2100 Nm, a hard ceiling of 6000 Nm — 17 kN, or 0.89 g.
  The car could never reach its own grip limit, so ABS had nothing to do and
  raising tyre μ changed the stopping distance not at all.

## 6. Assists

Traction control and ABS both act on the **pedal**, not on the tyre forces, so
the engine and its exhaust note respond exactly as they would to a real driver
lifting. Both are toggleable (`T`, `B`) — turning traction control off makes the
car a handful off the line, which is the correct outcome for 645 Nm through the
rear axle.
