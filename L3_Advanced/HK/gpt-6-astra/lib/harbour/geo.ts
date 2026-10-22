export const GRID = 0.5;
export const CHUNK = 256;
export const ORIGIN = { lon: 114.1694, lat: 22.29 };
export const BOUNDS = { minX: -2720, maxX: 2640, minZ: -2640, maxZ: 2560 };
export type Point = [number, number];
export function project(lon: number, lat: number): Point {
  return [(lon - ORIGIN.lon) * 111320 * Math.cos(ORIGIN.lat * Math.PI / 180), -(lat - ORIGIN.lat) * 111320];
}
export function unproject(x: number, z: number): Point {
  return [ORIGIN.lon + x / (111320 * Math.cos(ORIGIN.lat * Math.PI / 180)), ORIGIN.lat - z / 111320];
}
export function inside(x: number, z: number, polygon: Point[]) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}
export function distanceToSegment(x: number, z: number, a: Point, b: Point) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}
export function hash(n: number) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
export interface Feature { id: number; name: string; en?: string; p: Point[]; h?: number; base?: number; estimated?: boolean; kind?: string; }
export interface CityData { buildings: Feature[]; roads: Feature[]; land: Point[][]; coast: Point[][]; parks: Feature[]; piers: Feature[]; meta: { date: string; source: string; buildings: number; measuredHeights: number } }
export const LANDMARKS = [
  { id: 'ifc', name: '国际金融中心', en: 'TWO IFC', lon: 114.1596, lat: 22.2852, height: 412, displayHeight: '412 m', area: '中环 · 香港岛', desc: '八组向上收束的幕墙柱带与冠顶，共同构成中环海滨的标志。', source: 'https://www.skyscrapercenter.com/building/two-international-finance-centre/205' },
  { id: 'boc', name: '中银大厦', en: 'BANK OF CHINA TOWER', lon: 114.1615, lat: 22.2793, height: 367.5, displayHeight: '367.4 m', area: '金钟 · 香港岛', desc: '以四个逐节升高的三角形塔身，重现贝聿铭设计中的竹节意象。', source: 'https://www.bochk.com/en/aboutus/corpprofile/boctower.html' },
  { id: 'icc', name: '环球贸易广场', en: 'INTERNATIONAL COMMERCE CENTRE', lon: 114.1602, lat: 22.3034, height: 484, displayHeight: '484 m', area: '西九龙 · 九龙', desc: '屹立于西九龙的垂直地标，与对岸 IFC 共同界定维港的西侧门户。', source: 'https://www.shkp.com/en-US/our-business/hong-kong-properties/offices/international-commerce-centre-icc' },
  { id: 'hkcec', name: '香港会议展览中心', en: 'CONVENTION & EXHIBITION CENTRE', lon: 114.1730, lat: 22.2845, height: 64, displayHeight: '湾仔海滨', area: '湾仔 · 香港岛', desc: '伸入海港的会展半岛，以逐层阶梯体素表达海鸟展翅般的屋顶。', source: 'https://www.hkcec.com/en/location-transportation' },
] as const;
export const VIEWS = [
  { id: 'harbour', name: '维港全景', en: 'The iconic skyline', position: [2400, 2650, -3900], target: [-80, 60, 100], walk: [114.1714, 22.2932] },
  { id: 'tsim', name: '尖沙咀海滨', en: 'Across the harbour', position: [550, 310, -660], target: [-320, 140, 850], walk: [114.1714, 22.2932] },
  { id: 'central', name: '中环天际线', en: 'At the water’s edge', position: [-1760, 750, -430], target: [-820, 110, 940], walk: [114.1605, 22.2864] },
  { id: 'wan', name: '湾仔海滨', en: 'A different perspective', position: [1750, 820, -400], target: [450, 50, 740], walk: [114.1751, 22.2837] },
] as const;
