// 地图回归：五张图逐一加载，验证配置里的 id 全部能解析、地形能生成、无运行时错误。
// 单独成脚本是因为每张图都要新开页面，塞进 smoke 会让主流程变得又慢又难读。
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAPS = ['zone0', 'warehouse', 'farm', 'jlab', 'storm'];
const MAP_NAMES = { zone0: '零号区', warehouse: '仓库区', farm: '农场镇', jlab: 'J-Lab 实验室', storm: '风暴区' };

let pass = 0, total = 0;
const check = (name, ok, note = '') => {
  total++;
  if (ok) pass++;
  console.log(`  ${ok ? '✓' : '✗'} ${name}${note ? `  — ${note}` : ''}`);
};

const b = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--allow-file-access-from-files'],
});
console.log('[maps] 逐图验证：配置可解析 + 地形可生成 + 无运行时错误');

for (const map of MAPS) {
  const page = await b.newPage({ viewport: { width: 420, height: 260 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message.split('\n')[0]));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); });
  await page.goto(
    pathToFileURL(join(ROOT, 'dist/index.html')).href + `?msaa=0&fx=0&autostart=1&map=${map}`,
    { waitUntil: 'load', timeout: 90000 }
  );
  await page.waitForFunction(() => !!window.__GAME, null, { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(1600);
  const info = await page.evaluate(() => {
    const g = window.__DUCKBOID;
    if (!g || !g.world) return null;
    return {
      id: g.mapDef.id,
      size: [g.world.w, g.world.h],
      props: g.world.props?.length ?? 0,
      containers: g.world.containers?.length ?? 0,
      exits: g.world.exitPoints?.length ?? 0,
      enemies: g.enemies?.length ?? 0,
      weather: g.weather?.id,
      fatal: document.getElementById('fatalMsg')?.textContent?.slice(0, 90) || '',
    };
  });
  const name = MAP_NAMES[map];
  check(`${name}(${map}) 加载`, !!info && !info.fatal && errs.length === 0,
    info ? `${info.size.join('×')} 道具${info.props} 容器${info.containers} 敌${info.enemies} 天气${info.weather}`
      : `启动失败: ${errs[0] || info?.fatal || '未知'}`);
  if (info) {
    check(`${name} 地图 id 解析正确`, info.id === map, info.id);
    check(`${name} 有撤离点`, info.exits > 0, `${info.exits} 个`);
    check(`${name} 有可搜刮容器`, info.containers > 0, `${info.containers} 个`);
    check(`${name} 有敌人`, info.enemies > 0, `${info.enemies} 只`);
  }
  await page.close();
}

// 风暴区必须锁定雷暴
const page = await b.newPage({ viewport: { width: 420, height: 260 } });
await page.goto(pathToFileURL(join(ROOT, 'dist/index.html')).href + '?msaa=0&fx=0&autostart=1&map=storm',
  { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__GAME, null, { timeout: 45000 }).catch(() => {});
await page.waitForTimeout(1200);
const storm = await page.evaluate(() => {
  const g = window.__DUCKBOID;
  for (let i = 0; i < 200; i++) g.weather.updateHours(1);   // 无论怎么迁移都该锁死
  return g.weather.id;
});
check('风暴区天气锁定为雷暴', storm === 'storm', storm);
await page.close();

await b.close();
console.log(`\n[maps] ${pass}/${total} 通过`);
process.exit(pass === total ? 0 : 1);
