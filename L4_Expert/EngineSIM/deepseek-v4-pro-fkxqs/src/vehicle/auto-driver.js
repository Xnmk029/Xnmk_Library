/**
 * AutoDriver - a track-following driver good enough to lap at the limit.
 *
 * It exists for three reasons: the attract/demo mode in the browser, a
 * repeatable way to exercise the whole physics loop in CI (drive laps and assert
 * the car stays on the road with every state finite), and as a worked example of
 * how the vehicle is meant to be driven.
 *
 * Steering is deliberately *not* plain pure pursuit. At 1.2 g a tyre needs
 * several degrees of slip angle to make its force, so a geometric controller
 * asks for far too little lock and runs wide. The law used here is
 *
 *   steer = ackermann(curvature)          geometry of the corner
 *         + slip feed-forward             what the tyre needs to make the force
 *         + heading error term            align with the track
 *         + cross-track term (Stanley)    return to the line
 *         - yaw-rate damping              stop it weaving
 *
 * Speed control is a planner (brake early enough for the slowest corner in
 * range) plus a PI with anti-windup, because a wound-up integrator is exactly
 * how a controller misses a braking point.
 */

const GRAVITY = 9.80665;

function clamp(x, lo, hi) {
  return x < lo ? lo : x > hi ? hi : x;
}

function wrapAngle(a) {
  let x = a;
  while (x > Math.PI) x -= 2 * Math.PI;
  while (x < -Math.PI) x += 2 * Math.PI;
  return x;
}

export class AutoDriver {
  /**
   * @param {import('../track/track-layout.js').TrackLayout} layout
   * @param {object} [options]
   * @param {number} [options.lateralGripG] cornering budget the planner uses
   * @param {number} [options.brakingG] braking budget the planner uses
   * @param {number} [options.aggression] 0..1 scale on every target speed
   * @param {number} [options.topSpeedMps] straight-line target
   * @param {number} [options.peakSlipAngleRad] slip angle used by the feed-forward
   */
  constructor(
    layout,
    { lateralGripG = 1.0, brakingG = 0.95, aggression = 0.89, topSpeedMps = 74, peakSlipAngleRad = 0.13 } = {},
  ) {
    this.layout = layout;
    this.lateralGripG = lateralGripG;
    this.brakingG = brakingG;
    this.aggression = aggression;
    this.topSpeedMps = topSpeedMps;
    this.peakSlipAngleRad = peakSlipAngleRad;
    this.reset();
  }

  reset() {
    this.speedIntegral = 0;
    this.targetSpeed = 0;
    this.lookaheadM = 20;
    this.lastInput = { throttle: 0, brake: 0, steer: 0 };
    this.diagnostics = this.snapshot();
    return this;
  }

  /**
   * Everything the controller decided in its last `update()`: the lab panel
   * draws these numbers live, and the browser test reads the same fields, so
   * "what the auto driver is thinking" is not a hidden variable.
   */
  snapshot() {
    return {
      active: false,
      targetSpeedMps: this.targetSpeed,
      actualSpeedMps: 0,
      speedErrorMps: 0,
      throttle: this.lastInput.throttle,
      brake: this.lastInput.brake,
      steer: this.lastInput.steer,
      lookaheadM: this.lookaheadM,
      plannedGripScale: 1,
      offLineAmount: 0,
      lateralErrorM: 0,
      curvatureAtCar: 0,
      ackermannRad: 0,
      slipFeedforwardRad: 0,
      headingErrorRad: 0,
      crossTrackTermRad: 0,
      yawDampingRad: 0,
      steerAngleRad: 0,
      speedIntegral: 0,
      frontSlipLimited: false,
    };
  }

  /**
   * Slowest speed the car may carry right now given every corner in range.
   * @param {number} startDistance lap distance of the car
   * @param {number} speed current speed (m/s)
   */
  planSpeed(startDistance, speed, gripScale = 1) {
    const lateralGrip = this.lateralGripG * gripScale;
    const brakingGrip = this.brakingG * gripScale;
    const planDistance = clamp((speed * speed) / (2 * brakingGrip * GRAVITY) + 60, 80, 600);
    let limit = this.topSpeedMps;
    for (let ahead = 4; ahead <= planDistance; ahead += 4) {
      const point = this.layout.sampleAtDistance(startDistance + ahead);
      const curvature = Math.abs(point.curvature);
      if (curvature < 1e-5) continue;
      const cornerSpeed = Math.sqrt((lateralGrip * GRAVITY) / curvature);
      const allowed = Math.sqrt(cornerSpeed * cornerSpeed + 2 * brakingGrip * GRAVITY * ahead);
      if (allowed < limit) limit = allowed;
    }
    return limit * this.aggression;
  }

  /**
   * Compute driver inputs for the current vehicle state.
   * @param {import('./vehicle-model.js').VehicleModel} vehicle
   * @param {number} dt
   * @returns {{throttle:number, brake:number, steer:number}}
   */
  update(vehicle, dt) {
    const layout = this.layout;
    const speed = Math.max(vehicle.vx, 0);
    const near = layout.nearest(vehicle.x, vehicle.y);
    const diagnostics = this.diagnostics;
    diagnostics.active = true;
    diagnostics.actualSpeedMps = speed;
    diagnostics.lateralErrorM = -near.lateral;
    diagnostics.curvatureAtCar = near.curvature;

    // Plan against the grip actually under the tyres, and back off while the car
    // is off the racing surface - otherwise one mistake compounds into a spin.
    const gripScale = clamp(vehicle.surface?.friction ?? 1, 0.4, 1.2);
    const offAmount = clamp((Math.abs(near.lateral) - near.halfWidth * 0.85) / 6, 0, 1);
    this.targetSpeed = this.planSpeed(near.distance, speed, gripScale) * (1 - 0.5 * offAmount);
    diagnostics.plannedGripScale = gripScale;
    diagnostics.offLineAmount = offAmount;
    diagnostics.targetSpeedMps = this.targetSpeed;
    diagnostics.speedErrorMps = this.targetSpeed - speed;

    // ---- longitudinal: PI with anti-windup and a clean brake/throttle split
    const error = this.targetSpeed - speed;
    const proportional = error * 0.5;
    if (Math.abs(error) < 4 && Math.abs(proportional + this.speedIntegral) < 1) {
      this.speedIntegral = clamp(this.speedIntegral + error * dt * 0.6, -0.4, 0.4);
    } else {
      this.speedIntegral *= Math.max(0, 1 - dt * 4);
    }
    const demand = proportional + this.speedIntegral;
    let throttle = clamp(demand, 0, 1);
    let brake = clamp(-demand * 1.1, 0, 1);
    if (brake > 0.02) throttle = 0;
    diagnostics.speedIntegral = this.speedIntegral;

    // ---- lateral: geometry + tyre slip feed-forward + error feedback
    // The look-ahead shrinks in tight corners; a long look-ahead in a hairpin
    // cuts the apex and puts the car in the grass on exit.
    const localCurvature = Math.abs(near.curvature);
    this.lookaheadM = clamp((6 + speed * 0.85) / (1 + 55 * localCurvature), 8, 48);
    const aim = layout.sampleAtDistance(near.distance + this.lookaheadM);
    const nearAim = layout.sampleAtDistance(near.distance + this.lookaheadM * 0.5);
    const curvature = nearAim.curvature * 0.65 + near.curvature * 0.35;
    const ackermann = Math.atan(vehicle.car.wheelbaseM * curvature);
    const requiredLatG = (speed * speed * Math.abs(curvature)) / GRAVITY;
    const slipFeedforward = Math.sign(curvature) * this.peakSlipAngleRad * clamp(requiredLatG / this.lateralGripG, 0, 1.1);
    const headingError = wrapAngle(aim.heading - vehicle.heading);
    const crossTrack = -near.lateral;
    const stanley = Math.atan2(1.6 * crossTrack, Math.max(speed, 6));
    const damping = vehicle.yawRate * 0.09;
    const steerAngle = ackermann + slipFeedforward + 0.85 * headingError + stanley - damping;
    const steer = vehicle.steerInputForAngle(steerAngle);

    diagnostics.ackermannRad = ackermann;
    diagnostics.slipFeedforwardRad = slipFeedforward;
    diagnostics.headingErrorRad = headingError;
    diagnostics.crossTrackTermRad = stanley;
    diagnostics.yawDampingRad = -damping;
    diagnostics.steerAngleRad = steerAngle;

    // Trail off the throttle while the front tyres are already saturated.
    if (Math.abs(vehicle.slipAngleFront) > 0.16 && throttle > 0.35) throttle = 0.35;
    diagnostics.frontSlipLimited = throttle < this.lastInput.throttle - 1e-3 || Math.abs(vehicle.slipAngleFront) > 0.16;

    diagnostics.throttle = throttle;
    diagnostics.brake = brake;
    diagnostics.steer = steer;
    this.lastInput = { throttle, brake, steer };
    return this.lastInput;
  }

  /**
   * Convenience: compute inputs, apply them and step the vehicle.
   * @param {import('./vehicle-model.js').VehicleModel} vehicle
   * @param {number} dt
   */
  drive(vehicle, dt) {
    const input = this.update(vehicle, dt);
    vehicle.setInput(input);
    vehicle.update(dt);
    return input;
  }
}
