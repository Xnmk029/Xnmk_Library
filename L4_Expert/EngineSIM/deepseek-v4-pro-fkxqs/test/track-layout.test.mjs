/**
 * Phase 2 - track geometry: closure, sanity, surface classification, lap timing.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { LapTimer, SURFACES, TrackLayout } from "../src/track/track-layout.js";

const track = new TrackLayout();

test("the circuit is a closed loop of a plausible length and width", () => {
  const info = track.describe();
  assert.ok(info.lengthM > 1500 && info.lengthM < 6000, `track length ${info.lengthM.toFixed(0)} m`);
  assert.ok(info.sampleCount > 400, "the centreline must be finely sampled");
  assert.ok(info.cornerCount >= 6, `only ${info.cornerCount} corners have kerbs`);
  assert.ok(info.minCornerRadiusM > 15, `tightest corner radius ${info.minCornerRadiusM.toFixed(1)} m is undrivable`);
  // Closure: the last sample must join back to the first.
  const first = track.samples[0];
  const last = track.samples[track.samples.length - 1];
  const gap = Math.hypot(first.x - last.x, first.y - last.y);
  assert.ok(Math.abs(gap - track.spacing) < track.spacing * 0.6, `loop does not close (gap ${gap.toFixed(2)} m)`);
});

test("consecutive samples are evenly spaced and headings are continuous", () => {
  const count = track.samples.length;
  for (let i = 0; i < count; i++) {
    const a = track.samples[i];
    const b = track.samples[(i + 1) % count];
    const step = Math.hypot(b.x - a.x, b.y - a.y);
    assert.ok(Math.abs(step - track.spacing) < track.spacing * 0.35, `sample ${i} step ${step.toFixed(3)} m`);
    let delta = b.heading - a.heading;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    assert.ok(Math.abs(delta) < 0.12, `heading jumped ${delta.toFixed(3)} rad at sample ${i}`);
    assert.ok(Number.isFinite(a.curvature) && Math.abs(a.curvature) < 0.2);
    assert.ok(a.halfWidth > 4 && a.halfWidth < 12);
  }
});

test("the track never crosses itself", () => {
  const samples = track.samples;
  const count = samples.length;
  let worst = Infinity;
  for (let i = 0; i < count; i++) {
    for (let j = 0; j < count; j++) {
      const circular = Math.min(Math.abs(i - j), count - Math.abs(i - j));
      if (circular < 15) continue;
      const gap = Math.hypot(samples[i].x - samples[j].x, samples[i].y - samples[j].y);
      if (gap < worst) worst = gap;
    }
  }
  const needed = 2 * track.halfWidthM + 2 * track.kerbWidthM;
  assert.ok(worst > needed, `two parts of the track come within ${worst.toFixed(1)} m (need ${needed.toFixed(1)} m)`);
});

test("nearest() agrees with a brute-force search", () => {
  const samples = track.samples;
  for (let k = 0; k < 40; k++) {
    const base = samples[Math.floor((k / 40) * samples.length)];
    const offset = ((k % 7) - 3) * 3.5;
    const x = base.x + base.normalX * offset + 0.7;
    const y = base.y + base.normalY * offset - 0.4;
    const fast = track.nearest(x, y);
    let bestIndex = 0;
    let bestGap = Infinity;
    for (let i = 0; i < samples.length; i++) {
      const gap = Math.hypot(samples[i].x - x, samples[i].y - y);
      if (gap < bestGap) {
        bestGap = gap;
        bestIndex = i;
      }
    }
    assert.ok(Math.abs(fast.gap - bestGap) < 0.75, `gap ${fast.gap.toFixed(2)} vs brute force ${bestGap.toFixed(2)}`);
    const indexDelta = Math.min(
      Math.abs(fast.index - bestIndex),
      samples.length - Math.abs(fast.index - bestIndex),
    );
    assert.ok(indexDelta <= 2, `index ${fast.index} vs ${bestIndex}`);
    assert.ok(Math.abs(Math.abs(fast.lateral) - bestGap) < 1.2, "lateral offset must match the distance to the line");
  }
});

test("surfaces are classified by distance from the centreline", () => {
  // Pick a corner so that a painted kerb exists there.
  let tightest = 0;
  track.samples.forEach((sample, index) => {
    if (Math.abs(sample.curvature) > Math.abs(track.samples[tightest].curvature)) tightest = index;
  });
  const corner = track.samples[tightest];
  const outside = corner.curvature > 0 ? 1 : -1;
  const probe = (offset) => {
    const x = corner.x + corner.normalX * offset * outside;
    const y = corner.y + corner.normalY * offset * outside;
    return track.surfaceAt(x, y);
  };
  assert.equal(probe(0).name, "asphalt");
  assert.equal(probe(corner.halfWidth * 0.8).name, "asphalt");
  assert.equal(probe(corner.halfWidth + track.kerbWidthM * 0.5).name, "kerb");
  assert.ok(probe(corner.halfWidth + track.kerbWidthM * 0.5).kerb > 0.5);
  const wide = probe(corner.halfWidth + track.kerbWidthM + track.apronWidthM + 4);
  assert.equal(wide.offTrack, true);
  assert.ok(wide.friction < SURFACES.asphalt.friction);
  assert.ok(wide.rollingScale > 1);
  // Far away is still handled, and still off track.
  const far = track.surfaceAt(9000, -9000);
  assert.equal(far.offTrack, true);
  assert.ok(Number.isFinite(far.lateral) && Number.isFinite(far.distance));
  // Straights have no painted kerb.
  const straight = track.sampleAtDistance(track.startLineDistanceM);
  const straightEdge = track.surfaceAt(
    straight.x - Math.sin(straight.heading) * (straight.halfWidth + 0.6),
    straight.y + Math.cos(straight.heading) * (straight.halfWidth + 0.6),
  );
  assert.notEqual(straightEdge.name, "kerb");
});

test("degenerate positions and configurations are handled", () => {
  assert.deepEqual(
    Object.keys(track.surfaceAt(NaN, NaN)).includes("friction"),
    true,
  );
  assert.equal(track.surfaceAt(NaN, 0).friction, 1);
  assert.throws(() => new TrackLayout({ controlPoints: [[0, 0], [1, 1]] }));
  const tiny = new TrackLayout({ controlPoints: [[0, 0], [60, 0], [60, 60], [0, 60]], sampleSpacingM: 3 });
  assert.ok(tiny.lengthM > 150 && tiny.lengthM < 400);
  assert.ok(tiny.samples.length > 40);
});

test("sampleAtDistance wraps and interpolates continuously", () => {
  const a = track.sampleAtDistance(0);
  const b = track.sampleAtDistance(track.lengthM);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 0.1, "distance 0 and one lap must be the same point");
  const c = track.sampleAtDistance(-10);
  const d = track.sampleAtDistance(track.lengthM - 10);
  assert.ok(Math.hypot(c.x - d.x, c.y - d.y) < 0.1, "negative distances must wrap");
  let previous = track.sampleAtDistance(0);
  for (let s = 1; s < track.lengthM; s += 1.5) {
    const point = track.sampleAtDistance(s);
    assert.ok(Math.hypot(point.x - previous.x, point.y - previous.y) < 3, `jump at ${s} m`);
    assert.ok(Number.isFinite(point.heading) && Number.isFinite(point.curvature));
    previous = point;
  }
});

test("the start pose sits on the road, pointing along it", () => {
  const pose = track.startPose();
  const surface = track.surfaceAt(pose.x, pose.y);
  assert.equal(surface.name, "asphalt");
  assert.ok(Math.abs(surface.lateral) < track.halfWidthM);
  const near = track.nearest(pose.x, pose.y);
  let headingError = pose.heading - near.heading;
  while (headingError > Math.PI) headingError -= 2 * Math.PI;
  while (headingError < -Math.PI) headingError += 2 * Math.PI;
  assert.ok(Math.abs(headingError) < 0.08, `start heading is ${headingError.toFixed(3)} rad off the track`);
  // The grid is behind the start line, so the car drives over it first.
  assert.ok(near.distance < track.startLineDistanceM);
});

test("lap timing arms on the first crossing and then banks laps", () => {
  const timer = new LapTimer(track);
  const step = 0.02;
  const speed = 40; // m/s
  let distance = track.startLineDistanceM - 100;
  let laps = 0;
  for (let i = 0; i < 6000; i++) {
    distance += speed * step;
    const result = timer.update(step, distance % track.lengthM);
    if (result.crossedLine) laps++;
  }
  const snapshot = timer.snapshot();
  assert.ok(laps >= 3, `saw ${laps} crossings`);
  assert.equal(snapshot.lapCount, laps - 1, "the first crossing arms the timer instead of banking a lap");
  assert.ok(snapshot.timing);
  const expected = track.lengthM / speed;
  assert.ok(
    Math.abs(snapshot.lastLapTime - expected) < 0.5,
    `lap time ${snapshot.lastLapTime.toFixed(2)} s vs expected ${expected.toFixed(2)} s`,
  );
  assert.ok(snapshot.bestLapTime <= snapshot.lastLapTime + 1e-9);
});

test("laps completed off the road are not banked", () => {
  const timer = new LapTimer(track);
  let distance = track.startLineDistanceM - 50;
  for (let i = 0; i < 200; i++) {
    distance += 25 * 0.02;
    timer.update(0.02, distance % track.lengthM, { valid: true });
  }
  assert.equal(timer.armed, true);
  const before = timer.lapCount;
  distance += track.lengthM;
  timer.update(0.02, distance % track.lengthM, { valid: false });
  assert.equal(timer.lapCount, before, "an invalid crossing must not count");
});
