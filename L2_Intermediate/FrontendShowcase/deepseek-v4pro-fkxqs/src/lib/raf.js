/**
 * One shared requestAnimationFrame ticker for the whole app.
 * Dozens of scramble/HUD widgets can subscribe without spawning dozens of
 * independent rAF loops (which is the #1 cause of jank in HUD-style pages).
 */

const subscribers = new Set();
let running = false;
let last = 0;

function loop(now) {
  const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
  last = now;

  // Snapshot so a callback that unsubscribes mid-tick cannot corrupt iteration.
  const list = Array.from(subscribers);
  for (let i = 0; i < list.length; i += 1) {
    if (subscribers.has(list[i])) list[i](now / 1000, dt);
  }

  if (subscribers.size > 0) {
    requestAnimationFrame(loop);
  } else {
    running = false;
    last = 0;
  }
}

/**
 * @param {(timeSeconds:number, deltaSeconds:number) => void} fn
 * @returns {() => void} unsubscribe
 */
export function onTick(fn) {
  subscribers.add(fn);
  if (!running) {
    running = true;
    requestAnimationFrame(loop);
  }
  return () => {
    subscribers.delete(fn);
  };
}
