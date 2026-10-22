/**
 * Shared driving helpers for the vehicle tests (kept out of `src` because they
 * only exist to script test manoeuvres).
 */

import { VehicleModel } from "../../src/vehicle/vehicle-model.js";

export const DT = 1 / 120;

/**
 * @param {object} [options]
 * @param {object} [options.pose]
 * @param {number} [options.gearIndex]
 * @param {boolean} [options.autoShift]
 * @param {(x:number,y:number)=>object} [options.surfaceAt]
 * @param {object} [options.car]
 */
export function makeVehicle({ pose = {}, gearIndex = null, autoShift = true, surfaceAt = null, car = null } = {}) {
  const vehicle = new VehicleModel({ surfaceAt, ...(car ? { car } : {}) });
  vehicle.setAutoShift(autoShift);
  vehicle.reset(pose);
  if (gearIndex !== null) {
    vehicle.powertrain.gearIndex = gearIndex;
    vehicle.powertrain.shiftTimer = 0;
  }
  return vehicle;
}

/**
 * Drive for `seconds` with a fixed or scripted input.
 * @param {VehicleModel} vehicle
 * @param {number} seconds
 * @param {object|((t:number, vehicle:VehicleModel)=>object)} input
 * @param {(vehicle:VehicleModel)=>void} [onStep]
 */
export function drive(vehicle, seconds, input, onStep) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    vehicle.setInput(typeof input === "function" ? input(vehicle.time, vehicle) : input);
    vehicle.update(DT);
    if (onStep) onStep(vehicle);
  }
  return vehicle;
}

/** Assertion helper: every numeric field of a telemetry snapshot is finite. */
export function collectNonFinite(telemetry, path = "") {
  const problems = [];
  for (const [key, value] of Object.entries(telemetry)) {
    const name = path ? `${path}.${key}` : key;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) problems.push(`${name}=${value}`);
    } else if (value && typeof value === "object") {
      problems.push(...collectNonFinite(value, name));
    }
  }
  return problems;
}
