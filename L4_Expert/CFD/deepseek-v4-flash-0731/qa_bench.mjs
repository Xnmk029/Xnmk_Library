// CPU physics benchmark: reports ms/step and estimated physics cost at 60 FPS
import { createSolver } from './src/sph.js';

for (const preset of ['low', 'medium', 'high']) {
  const solver = createSolver(preset);
  solver.time = -0.6;
  // run through settle + early flow so the measurement reflects flowing state
  while (solver.time < 0.25) solver.step(solver.dt);
  for (let i = 0; i < 30; i++) solver.step(solver.dt); // warmup
  const N = 150;
  const t0 = performance.now();
  for (let i = 0; i < N; i++) solver.step(solver.dt);
  const ms = (performance.now() - t0) / N;
  const substeps = (1 / 60) / solver.dt;
  const framePhys = ms * substeps;
  const speed = 16.7 / framePhys;
  console.log(
    preset.padEnd(8),
    'N=' + String(solver.count).padStart(5),
    'pairs=' + String(solver.pairCount).padStart(6),
    'iter=' + solver.iterations,
    'dt=' + solver.dt.toFixed(4),
    'ms/step=' + ms.toFixed(2),
    'phys@60fps=' + framePhys.toFixed(1) + ' ms',
    'est sim=' + speed.toFixed(2) + 'x'
  );
}
