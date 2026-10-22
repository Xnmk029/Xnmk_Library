/**
 * HUD formatting. Pure functions so Node tests can verify displayed fields
 * without a browser.
 */

export function formatHud(state) {
  const st = state || {};
  const rpm = Number.isFinite(st.rpm) ? st.rpm : 0;
  const kmh = Number.isFinite(st.speedKmh) ? st.speedKmh : 0;
  const gear = st.gear >= 1 ? String(st.gear) : 'N';
  const throttlePct = Math.round(Math.max(0, Math.min(1, st.throttle || 0)) * 100);
  const loadPct = Math.round(Math.max(0, Math.min(1, st.load || 0)) * 100);
  let status = 'RUN';
  if (st.fuelCut) status = 'CUT';
  else if ((st.throttle || 0) < 0.05 && rpm < 950 && kmh < 2) status = 'IDLE';
  else if ((st.brake || 0) > 0.2) status = 'BRAKE';
  else if ((st.throttle || 0) > 0.7) status = 'WOT';
  return {
    rpm: Math.round(rpm),
    rpmText: String(Math.round(rpm)),
    speedKmh: Math.round(kmh),
    speedText: String(Math.round(kmh)),
    gear,
    throttlePct,
    throttleText: throttlePct + '%',
    loadPct,
    status,
    fuelCut: !!st.fuelCut,
    layout: st.layout || 'front-mid',
  };
}

export const HUD_FIELDS = Object.freeze([
  'rpm',
  'speedKmh',
  'gear',
  'throttlePct',
  'status',
]);
