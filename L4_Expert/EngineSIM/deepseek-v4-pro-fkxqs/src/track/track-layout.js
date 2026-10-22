/**
 * Track geometry - pure maths, no renderer.
 *
 * The same object serves three consumers:
 *   - the physics, through `surfaceAt(x, y)` (grip, rolling resistance, kerbs,
 *     off-track detection),
 *   - the renderer, through `samples`, `boundaries()` and `kerbRuns()`,
 *   - the lap logic and the tests, through `nearest()` and `lengthM`.
 *
 * The centreline is a closed Catmull-Rom spline through hand-placed control
 * points, resampled at a fixed arc-length spacing so every downstream consumer
 * can index it cheaply.
 */

/** Surface classes and what they do to the car. */
export const SURFACES = Object.freeze({
  asphalt: Object.freeze({ name: "asphalt", friction: 1, rollingScale: 1, kerb: 0, offTrack: false }),
  kerb: Object.freeze({ name: "kerb", friction: 0.9, rollingScale: 1.5, kerb: 1, offTrack: false }),
  apron: Object.freeze({ name: "apron", friction: 0.82, rollingScale: 1.2, kerb: 0.25, offTrack: false }),
  grass: Object.freeze({ name: "grass", friction: 0.52, rollingScale: 4.5, kerb: 0, offTrack: true }),
  gravel: Object.freeze({ name: "gravel", friction: 0.62, rollingScale: 7, kerb: 0, offTrack: true }),
});

/**
 * "Cedar Ridge Motorsport Park" - a 2.5 km club circuit: one long main straight,
 * a fast open right, a technical middle section, a hairpin and a late sweeper
 * that spits the car back onto the straight.
 *
 * Coordinates are metres in the physics plane (x east, y north).
 */
export const CEDAR_RIDGE_CONTROL_POINTS = Object.freeze([
  [-270, -180],
  [-120, -186],
  [40, -188],
  [200, -184],
  [320, -168],
  [386, -120],
  [404, -50],
  [398, 26],
  [364, 96],
  [300, 132],
  [236, 152],
  [196, 202],
  [198, 262],
  [154, 302],
  [62, 316],
  [-42, 314],
  [-122, 300],
  [-162, 258],
  [-146, 212],
  [-92, 194],
  [-26, 186],
  [16, 152],
  [4, 106],
  [-52, 88],
  [-116, 96],
  [-186, 74],
  [-252, 22],
  [-282, -68],
]);

/** Default geometry of the road surface itself. */
export const DEFAULT_TRACK_OPTIONS = Object.freeze({
  halfWidthM: 6.4,
  kerbWidthM: 1.2,
  apronWidthM: 3.5,
  /** Arc-length spacing of the resampled centreline. */
  sampleSpacingM: 2,
  /** Curvature above which a kerb is painted (1/radius). */
  kerbCurvatureThreshold: 0.0055,
  /** Distance along the lap of the start/finish line (middle of the straight). */
  startLineDistanceM: 300,
  /** Extra width added on corner exits, as a fraction of half width. */
  widthVariation: 0.12,
});

function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return [
    0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
  ];
}

function wrapIndex(i, n) {
  return ((i % n) + n) % n;
}

export class TrackLayout {
  /**
   * @param {object} [options]
   * @param {number[][]} [options.controlPoints]
   * @param {number} [options.halfWidthM]
   * @param {number} [options.kerbWidthM]
   * @param {number} [options.apronWidthM]
   * @param {number} [options.sampleSpacingM]
   * @param {number} [options.kerbCurvatureThreshold]
   * @param {number} [options.startLineDistanceM]
   * @param {string} [options.name]
   */
  constructor(options = {}) {
    const settings = { ...DEFAULT_TRACK_OPTIONS, ...options };
    this.name = options.name ?? "Cedar Ridge Motorsport Park";
    this.controlPoints = (options.controlPoints ?? CEDAR_RIDGE_CONTROL_POINTS).map(([x, y]) => [x, y]);
    if (this.controlPoints.length < 4) throw new Error("a track needs at least 4 control points");
    this.halfWidthM = settings.halfWidthM;
    this.kerbWidthM = settings.kerbWidthM;
    this.apronWidthM = settings.apronWidthM;
    this.sampleSpacingM = settings.sampleSpacingM;
    this.kerbCurvatureThreshold = settings.kerbCurvatureThreshold;
    this.startLineDistanceM = settings.startLineDistanceM;
    this.widthVariation = settings.widthVariation;
    this.build();
  }

  /** @private Build the resampled centreline and everything derived from it. */
  build() {
    // 1. dense spline evaluation
    const dense = [];
    const n = this.controlPoints.length;
    const stepsPerSegment = 48;
    for (let i = 0; i < n; i++) {
      const p0 = this.controlPoints[wrapIndex(i - 1, n)];
      const p1 = this.controlPoints[i];
      const p2 = this.controlPoints[wrapIndex(i + 1, n)];
      const p3 = this.controlPoints[wrapIndex(i + 2, n)];
      for (let s = 0; s < stepsPerSegment; s++) {
        dense.push(catmullRom(p0, p1, p2, p3, s / stepsPerSegment));
      }
    }
    // 2. arc length of the dense polyline
    const cumulative = [0];
    for (let i = 1; i <= dense.length; i++) {
      const a = dense[i - 1];
      const b = dense[i % dense.length];
      cumulative.push(cumulative[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    const total = cumulative[dense.length];
    this.lengthM = total;

    // 3. resample at constant spacing
    const count = Math.max(16, Math.round(total / this.sampleSpacingM));
    this.spacing = total / count;
    /** @type {{x:number,y:number,distance:number,heading:number,curvature:number,halfWidth:number,kerb:number,normalX:number,normalY:number}[]} */
    this.samples = new Array(count);
    let cursor = 0;
    for (let i = 0; i < count; i++) {
      const target = i * this.spacing;
      while (cursor < dense.length - 1 && cumulative[cursor + 1] < target) cursor++;
      const segmentLength = cumulative[cursor + 1] - cumulative[cursor];
      const t = segmentLength > 1e-9 ? (target - cumulative[cursor]) / segmentLength : 0;
      const a = dense[cursor];
      const b = dense[(cursor + 1) % dense.length];
      this.samples[i] = {
        x: a[0] + (b[0] - a[0]) * t,
        y: a[1] + (b[1] - a[1]) * t,
        distance: target,
        heading: 0,
        curvature: 0,
        halfWidth: this.halfWidthM,
        kerb: 0,
        normalX: 0,
        normalY: 0,
      };
    }

    // 4. heading, curvature, normals
    for (let i = 0; i < count; i++) {
      const previous = this.samples[wrapIndex(i - 1, count)];
      const next = this.samples[wrapIndex(i + 1, count)];
      const dx = next.x - previous.x;
      const dy = next.y - previous.y;
      const sample = this.samples[i];
      sample.heading = Math.atan2(dy, dx);
      sample.normalX = -Math.sin(sample.heading);
      sample.normalY = Math.cos(sample.heading);
    }
    for (let i = 0; i < count; i++) {
      const previous = this.samples[wrapIndex(i - 1, count)];
      const next = this.samples[wrapIndex(i + 1, count)];
      let delta = next.heading - previous.heading;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      this.samples[i].curvature = delta / (2 * this.spacing);
    }
    // Smooth the curvature (finite differences on a resampled spline are noisy).
    const smoothed = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      let sum = 0;
      for (let k = -3; k <= 3; k++) sum += this.samples[wrapIndex(i + k, count)].curvature;
      smoothed[i] = sum / 7;
    }
    for (let i = 0; i < count; i++) this.samples[i].curvature = smoothed[i];

    // 5. kerbs where the corner is tight enough, plus a little extra width on
    //    the outside of fast corners (tracks are not constant width).
    for (let i = 0; i < count; i++) {
      const sample = this.samples[i];
      const strength = Math.min(1, Math.max(0, (Math.abs(sample.curvature) - this.kerbCurvatureThreshold) / 0.008));
      sample.kerb = strength;
      sample.halfWidth = this.halfWidthM * (1 + this.widthVariation * Math.min(1, Math.abs(sample.curvature) * 90));
    }
    // Smooth the kerb strength so painted kerbs start and end gradually.
    const kerbSmoothed = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      let sum = 0;
      for (let k = -4; k <= 4; k++) sum += this.samples[wrapIndex(i + k, count)].kerb;
      kerbSmoothed[i] = sum / 9;
    }
    for (let i = 0; i < count; i++) this.samples[i].kerb = kerbSmoothed[i];

    // 6. coarse spatial grid so surfaceAt() is O(1) instead of O(n)
    this.cellSize = 24;
    this.grid = new Map();
    for (let i = 0; i < count; i++) {
      const sample = this.samples[i];
      const key = this.cellKey(sample.x, sample.y);
      let bucket = this.grid.get(key);
      if (!bucket) {
        bucket = [];
        this.grid.set(key, bucket);
      }
      bucket.push(i);
    }
    this.lastNearestIndex = 0;
  }

  /** @private */
  cellKey(x, y) {
    return `${Math.floor(x / this.cellSize)}:${Math.floor(y / this.cellSize)}`;
  }

  /** Number of centreline samples. */
  get sampleCount() {
    return this.samples.length;
  }

  /** Interpolated centreline point at a lap distance (metres, wraps). */
  sampleAtDistance(distanceM) {
    const count = this.samples.length;
    const wrapped = ((distanceM % this.lengthM) + this.lengthM) % this.lengthM;
    const position = wrapped / this.spacing;
    const i = Math.floor(position) % count;
    const t = position - Math.floor(position);
    const a = this.samples[i];
    const b = this.samples[(i + 1) % count];
    let headingDelta = b.heading - a.heading;
    while (headingDelta > Math.PI) headingDelta -= 2 * Math.PI;
    while (headingDelta < -Math.PI) headingDelta += 2 * Math.PI;
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      heading: a.heading + headingDelta * t,
      curvature: a.curvature + (b.curvature - a.curvature) * t,
      halfWidth: a.halfWidth + (b.halfWidth - a.halfWidth) * t,
      kerb: a.kerb + (b.kerb - a.kerb) * t,
      distance: wrapped,
    };
  }

  /**
   * Nearest point on the centreline to a world position.
   * @param {number} x
   * @param {number} y
   * @returns {{index:number, distance:number, lateral:number, heading:number, curvature:number, halfWidth:number, kerb:number, gap:number}}
   */
  nearest(x, y) {
    const count = this.samples.length;
    let best = -1;
    let bestGap = Infinity;
    // Look in the 3x3 grid cells around the query point first.
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        const bucket = this.grid.get(`${gx}:${gy}`);
        if (!bucket) continue;
        for (const index of bucket) {
          const sample = this.samples[index];
          const gap = (sample.x - x) ** 2 + (sample.y - y) ** 2;
          if (gap < bestGap) {
            bestGap = gap;
            best = index;
          }
        }
      }
    }
    if (best < 0) {
      // Far off track: fall back to a coarse scan, then refine.
      for (let index = 0; index < count; index += 4) {
        const sample = this.samples[index];
        const gap = (sample.x - x) ** 2 + (sample.y - y) ** 2;
        if (gap < bestGap) {
          bestGap = gap;
          best = index;
        }
      }
      for (let k = -4; k <= 4; k++) {
        const index = wrapIndex(best + k, count);
        const sample = this.samples[index];
        const gap = (sample.x - x) ** 2 + (sample.y - y) ** 2;
        if (gap < bestGap) {
          bestGap = gap;
          best = index;
        }
      }
    }
    const sample = this.samples[best];
    const dx = x - sample.x;
    const dy = y - sample.y;
    // Signed lateral offset: positive to the left of the driving direction.
    const lateral = dx * sample.normalX + dy * sample.normalY;
    const along = dx * Math.cos(sample.heading) + dy * Math.sin(sample.heading);
    this.lastNearestIndex = best;
    return {
      index: best,
      distance: (sample.distance + along + this.lengthM) % this.lengthM,
      lateral,
      heading: sample.heading,
      curvature: sample.curvature,
      halfWidth: sample.halfWidth,
      kerb: sample.kerb,
      gap: Math.sqrt(bestGap),
    };
  }

  /**
   * Surface under a world position, in the shape the vehicle model expects.
   * @param {number} x
   * @param {number} y
   */
  surfaceAt(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { ...SURFACES.asphalt, lateral: 0, distance: 0 };
    const near = this.nearest(x, y);
    const offset = Math.abs(near.lateral);
    const edge = near.halfWidth;
    let base = SURFACES.asphalt;
    if (offset <= edge) {
      base = SURFACES.asphalt;
    } else if (offset <= edge + this.kerbWidthM) {
      // Kerb only exists where it is painted; elsewhere the edge is apron.
      base = near.kerb > 0.25 ? SURFACES.kerb : SURFACES.apron;
    } else if (offset <= edge + this.kerbWidthM + this.apronWidthM) {
      base = SURFACES.apron;
    } else if (offset <= edge + this.kerbWidthM + this.apronWidthM + 14) {
      base = SURFACES.grass;
    } else {
      base = SURFACES.gravel;
    }
    return {
      ...base,
      kerb: base === SURFACES.kerb ? Math.min(1, near.kerb + 0.3) : base.kerb,
      lateral: near.lateral,
      distance: near.distance,
      halfWidth: edge,
    };
  }

  /**
   * Start pose: on the grid, `gridOffsetM` before the start line and
   * `lateralOffsetM` to the side of the centreline (negative = right).
   * @param {number} [lateralOffsetM]
   * @param {number} [gridOffsetM]
   */
  startPose(lateralOffsetM = -1.9, gridOffsetM = 80) {
    const point = this.sampleAtDistance(this.startLineDistanceM - gridOffsetM);
    return {
      x: point.x - Math.sin(point.heading) * lateralOffsetM,
      y: point.y + Math.cos(point.heading) * lateralOffsetM,
      heading: point.heading,
      distance: point.distance,
    };
  }

  /** Left/right edge polylines, for building the road mesh. */
  boundaries() {
    const left = [];
    const right = [];
    for (const sample of this.samples) {
      left.push([sample.x + sample.normalX * sample.halfWidth, sample.y + sample.normalY * sample.halfWidth]);
      right.push([sample.x - sample.normalX * sample.halfWidth, sample.y - sample.normalY * sample.halfWidth]);
    }
    return { left, right };
  }

  /**
   * Continuous runs of painted kerb, as index ranges, so the renderer can build
   * one striped strip per corner instead of per sample.
   * @param {number} [threshold]
   */
  kerbRuns(threshold = 0.25) {
    const runs = [];
    const count = this.samples.length;
    let start = -1;
    for (let i = 0; i < count + 1; i++) {
      const active = this.samples[i % count].kerb > threshold;
      if (active && start < 0) start = i;
      if (!active && start >= 0) {
        if (i - start > 3) runs.push({ from: start % count, to: (i - 1) % count, length: i - start });
        start = -1;
      }
    }
    return runs;
  }

  /** Lap progress 0..1 for a distance along the lap. */
  lapProgress(distanceM) {
    const wrapped = ((distanceM - this.startLineDistanceM) % this.lengthM + this.lengthM) % this.lengthM;
    return wrapped / this.lengthM;
  }

  /** Geometry report used by the tests and the loading screen. */
  describe() {
    let minRadius = Infinity;
    let maxCurvature = 0;
    for (const sample of this.samples) {
      const curvature = Math.abs(sample.curvature);
      if (curvature > maxCurvature) maxCurvature = curvature;
      if (curvature > 1e-6) minRadius = Math.min(minRadius, 1 / curvature);
    }
    const kerbRuns = this.kerbRuns();
    return {
      name: this.name,
      lengthM: this.lengthM,
      sampleCount: this.samples.length,
      halfWidthM: this.halfWidthM,
      minCornerRadiusM: minRadius,
      maxCurvature,
      cornerCount: kerbRuns.length,
      kerbRuns,
    };
  }
}

/** Lap timing state machine driven by lap distance. */
export class LapTimer {
  /** @param {TrackLayout} layout */
  constructor(layout) {
    this.layout = layout;
    this.reset();
  }

  reset() {
    this.currentLapTime = 0;
    this.lastLapTime = 0;
    this.bestLapTime = 0;
    this.lapCount = 0;
    this.previousProgress = null;
    /** The first line crossing starts timing; it does not bank an out-lap. */
    this.armed = false;
    return this;
  }

  /**
   * @param {number} dt
   * @param {number} lapDistanceM distance along the centreline
   * @param {object} [options]
   * @param {boolean} [options.valid] false while the car is not really on the road
   * @returns {{crossedLine:boolean}}
   */
  update(dt, lapDistanceM, { valid = true } = {}) {
    const progress = this.layout.lapProgress(lapDistanceM);
    this.currentLapTime += Math.max(0, dt);
    let crossedLine = false;
    if (this.previousProgress !== null) {
      const delta = progress - this.previousProgress;
      // Forward crossing of the start line shows up as a big negative jump.
      if (delta < -0.5 && valid) {
        crossedLine = true;
        if (this.armed) {
          this.lapCount++;
          this.lastLapTime = this.currentLapTime;
          if (this.bestLapTime === 0 || this.currentLapTime < this.bestLapTime) {
            this.bestLapTime = this.currentLapTime;
          }
        } else {
          this.armed = true;
        }
        this.currentLapTime = 0;
      } else if (delta > 0.5) {
        // Backwards over the line: undo the lap rather than banking a fake one.
        this.lapCount = Math.max(0, this.lapCount - 1);
      }
    }
    this.previousProgress = progress;
    return { crossedLine };
  }

  snapshot() {
    return {
      lapCount: this.lapCount,
      currentLapTime: this.currentLapTime,
      lastLapTime: this.lastLapTime,
      bestLapTime: this.bestLapTime,
      timing: this.armed,
    };
  }
}
