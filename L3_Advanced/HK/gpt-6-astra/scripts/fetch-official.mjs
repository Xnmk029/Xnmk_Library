import fs from 'node:fs/promises';
const base = 'https://portal.csdi.gov.hk/server/rest/services/common/';
const catalog = JSON.parse(await fs.readFile('data/basemap-service.json', 'utf8'));
const land = catalog.layers.find(x => x.name === 'LANDPOLY (iB10K)');
const coast = catalog.layers.find(x => x.name === 'CoastLine_Line');
async function download(name, url, start = 0) {
  let offset = start;
  while (true) {
    const params = new URLSearchParams({ f: 'geojson', where: '1=1', geometry: '114.143,22.267,114.195,22.314', geometryType: 'esriGeometryEnvelope', inSR: '4326', outSR: '4326', outFields: '*', returnGeometry: 'true', resultRecordCount: '2000', resultOffset: String(offset), orderByFields: 'OBJECTID' });
    const res = await fetch(`${url}/query?${params}`, { signal: AbortSignal.timeout(90000) });
    const data = await res.json();
    if (!res.ok || data.error) throw Error(JSON.stringify(data));
    await fs.writeFile(`data/${name}-${offset}.geojson`, JSON.stringify(data));
    console.log(name, offset, data.features.length, 'features');
    if (!data.exceededTransferLimit || !data.features.length) break;
    offset += data.features.length;
  }
}
await download('buildings', base + 'landsd_rcd_1637211194312_35158/MapServer/0', 2000);
await download('roads', base + 'landsd_rcd_1637310758814_80061/MapServer/0');
await download('land', `https://ginfo.cedd.gov.hk/server/rest/services/Basemap/MapServer/${land.id}`);
await download('coast', `https://ginfo.cedd.gov.hk/server/rest/services/Basemap/MapServer/${coast.id}`);
