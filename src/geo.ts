/** Lon/lat continent outlines. Openings are famous straits — the only shot through. */

export type LonLat = [number, number];
export type Pt = { x: number; y: number };
export type GeoRegion = "world" | "europe" | "asia" | "americas";

export interface Opening {
  lon: number;
  lat: number;
  r: number;
  name: string;
}

export const OPENINGS: Opening[] = [
  { lon: -5.6, lat: 36.0, r: 3.6, name: "Gibraltar" },
  { lon: 32.4, lat: 30.6, r: 2.8, name: "Suez" },
  { lon: 29.0, lat: 41.1, r: 1.8, name: "Bosphorus" },
  { lon: 1.05, lat: 51.05, r: 2.1, name: "Channel" },
  { lon: 12.6, lat: 55.4, r: 1.8, name: "Skagerrak" },
  { lon: 56.4, lat: 26.6, r: 2.2, name: "Hormuz" },
  { lon: 43.4, lat: 12.6, r: 2.2, name: "Mandeb" },
  { lon: 101.0, lat: 2.2, r: 3.2, name: "Malacca" },
  { lon: 129.7, lat: 34.0, r: 2.6, name: "Korea" },
  { lon: 142.2, lat: -10.5, r: 3.4, name: "Torres" },
  { lon: 180, lat: 65.8, r: 16, name: "Bering" },
];

/** North America + Central America, pinched at Panama. */
const NORTH_AMERICA: LonLat[] = [
  [-168, 65], [-141, 60], [-130, 55], [-125, 49], [-124, 41], [-120, 34],
  [-117, 32], [-110, 24], [-105, 22], [-97, 16], [-91, 18], [-87, 13],
  [-84, 9], [-80, 8], [-77, 7.4], [-77.2, 8.6], [-81, 8.5], [-87, 16],
  [-95, 19], [-97, 26], [-90, 29], [-84, 30], [-81, 25], [-80, 27],
  [-81, 31], [-76, 35], [-74, 40], [-70, 42], [-67, 45], [-60, 47],
  [-56, 51], [-62, 58], [-70, 62], [-80, 64], [-90, 68], [-105, 68],
  [-120, 69], [-140, 70], [-156, 71], [-166, 68], [-168, 65],
];

const SOUTH_AMERICA: LonLat[] = [
  [-77, 8], [-75, 6], [-77, 0], [-80, -5], [-81, -14], [-76, -15],
  [-71, -18], [-70, -23], [-72, -36], [-74, -42], [-75, -47], [-73, -53],
  [-68, -55], [-65, -55], [-63, -50], [-65, -42], [-62, -39], [-58, -38],
  [-53, -34], [-48, -28], [-43, -23], [-39, -17], [-35, -8], [-35, -4],
  [-38, -8], [-44, -2], [-50, 0], [-52, 4], [-60, 8], [-68, 12],
  [-72, 12], [-77, 8],
];

const AFRICA: LonLat[] = [
  [-6, 36], [-1, 35], [6, 37], [10, 37], [11, 33], [20, 32], [25, 32],
  [32, 31.4], [34, 28], [33, 22], [38, 21], [43, 12], [51, 12], [51, 2],
  [47, -2], [43, -11], [40, -15], [35, -20], [32, -26], [29, -32],
  [20, -35], [18, -33], [14, -23], [13, -8], [10, 4], [4, 5], [-5, 5],
  [-10, 6], [-16, 12], [-17, 15], [-16, 21], [-10, 29], [-10, 32], [-6, 36],
];

/** Eurasia without UK / Japan. Sinai pinch toward Suez. */
const EURASIA: LonLat[] = [
  [-9, 43], [-9, 38], [-6.2, 36.2], [-1, 37], [3, 43], [9, 44], [12, 42],
  [16, 39], [18, 40], [23, 40], [27, 40.5], [29.2, 41.1], [32, 36],
  [35, 36], [36, 31], [34.5, 29.5], [32.6, 30.2], [35, 33], [38, 37],
  [44, 40], [48, 37], [52, 27], [56, 25], [57, 27], [60, 25], [66, 25],
  [70, 22], [73, 20], [77, 8], [80, 6], [80, 12], [86, 21], [92, 22],
  [97, 17], [100, 13], [104, 11], [109, 14], [109, 22], [120, 23],
  [122, 31], [121, 38], [128, 41], [130, 43], [141, 53], [160, 63],
  [172, 66], [176, 67], [170, 70], [140, 73], [100, 76], [70, 73],
  [44, 68], [30, 70], [20, 70], [12, 65], [8, 58], [5, 53], [-1, 51],
  [-5, 48], [-9, 43],
];

const BRITAIN: LonLat[] = [
  [-5.5, 50], [-5.2, 53.4], [-3, 56], [-1, 58.5], [0.2, 58.6], [1.6, 52.5],
  [1.3, 51.2], [-0.4, 50.6], [-5.5, 50],
];

const JAPAN: LonLat[] = [
  [130.8, 31.6], [131.2, 33.6], [135.2, 34.6], [140.8, 41.4], [145.5, 43.2],
  [144.2, 44], [140.2, 41], [139.4, 35.4], [131.5, 33], [130.8, 31.6],
];

/** Sumatra–Java–Borneo–New Guinea as one island chain. */
const INDONESIA: LonLat[] = [
  [95.2, 5.4], [102, 1.2], [105, -6.8], [110, -8], [115, -8.5], [122, -8],
  [131, -3], [134, 0], [130, 2.4], [120, 5], [109, 6], [100, 6.2], [95.2, 5.4],
];

const AUSTRALIA: LonLat[] = [
  [114, -22], [114, -34], [128, -32], [136, -35], [150, -38], [153, -28],
  [146, -19], [142, -11], [136, -12], [128, -14], [122, -16], [114, -22],
];

/** Asia land as its own cropped outline so a lon filter doesn't tear Eurasia. */
const ASIA: LonLat[] = [
  [32, 31], [35, 36], [38, 37], [44, 40], [48, 37], [52, 27], [56, 25],
  [60, 25], [66, 25], [70, 22], [73, 20], [77, 8], [80, 6], [80, 12],
  [86, 21], [92, 22], [97, 17], [104, 11], [109, 14], [109, 22], [120, 23],
  [122, 31], [121, 38], [128, 41], [141, 53], [160, 63], [172, 66],
  [170, 70], [140, 73], [100, 72], [80, 68], [70, 55], [60, 44], [48, 42],
  [40, 40], [36, 31], [32, 31],
];

const EUROPE: LonLat[] = [
  [-9, 43], [-9, 38], [-6.2, 36.2], [-1, 37], [3, 43], [9, 44], [12, 42],
  [16, 39], [18, 40], [24, 41], [29.2, 41.1], [30, 44], [28, 45], [29, 47],
  [38, 47], [40, 48], [40, 60], [30, 70], [20, 70], [12, 65], [8, 58],
  [5, 53], [-1, 51], [-5, 48], [-9, 43],
];

const MAGHREB: LonLat[] = [
  [-6, 36], [-1, 35], [6, 37], [10, 37], [11, 33], [8, 32], [-2, 32],
  [-10, 32], [-10, 35], [-6, 36],
];

export const LAND: Record<GeoRegion, LonLat[][]> = {
  world: [NORTH_AMERICA, SOUTH_AMERICA, AFRICA, EURASIA, BRITAIN, JAPAN, INDONESIA, AUSTRALIA],
  americas: [NORTH_AMERICA, SOUTH_AMERICA],
  asia: [ASIA, INDONESIA, JAPAN, AUSTRALIA],
  europe: [EUROPE, BRITAIN, MAGHREB],
};

export const HOMES: Record<GeoRegion, LonLat[]> = {
  europe: [
    [-1.2, 47.2],
    [28.4, 50.4],
  ],
  asia: [
    [36.2, 31.8],
    [78.0, 21.4],
    [116.4, 31.6],
  ],
  americas: [
    [-96, 51],
    [-97, 31],
    [-88, 15],
    [-48, -16],
  ],
  world: [
    [-123, 49], [-105, 40], [-97, 32], [-84, 34], [-90, 17], [-86, 14],
    [-74, 5], [-47, -16], [-64, -32], [-71, -33],
    [-2, 47], [12, 43], [21, 52], [16, 60], [-3, 53],
    [-6, 32], [8, 8], [32, 15], [18, -26], [31.2, 30.1],
    [48, 40], [54, 32], [77, 23], [100, 14], [116, 32], [128, 42], [104, 35],
    [139, 36], [107, -6], [145, -33], [133, -24], [37, 55],
  ],
};

/** Overnight World keeps the same coasts, 8 seats. */
export const WORLD_COMPACT: LonLat[] = [
  [-123, 49],
  [-97, 32],
  [-47, -16],
  [-2, 47],
  [8, 8],
  [77, 23],
  [116, 32],
  [145, -33],
];

export const GEO_CLEARANCE = 18;

export function wrapLon(lon: number, region: GeoRegion): number {
  if (region !== "world") return lon;
  return lon < -30 ? lon + 360 : lon;
}

export function project(lon: number, lat: number, region: GeoRegion): Pt {
  const lonW = wrapLon(lon, region);
  if (region === "world") {
    const scale = 6.05;
    return { x: (lonW - 168) * scale, y: -lat * scale * 0.9 };
  }
  if (region === "americas") {
    const scale = 7.4;
    return { x: (lon + 90) * scale, y: -lat * scale * 0.95 };
  }
  if (region === "asia") {
    const scale = 7.1;
    return { x: (lon - 95) * scale, y: -(lat - 18) * scale * 0.95 };
  }
  const scale = 14.2;
  return { x: (lon - 10) * scale, y: -(lat - 50) * scale };
}

function distDeg(a: LonLat, b: LonLat, region: GeoRegion): number {
  const dLon = wrapLon(a[0], region) - wrapLon(b[0], region);
  const dLat = a[1] - b[1];
  return Math.hypot(dLon, dLat);
}

function densify(poly: LonLat[], maxDeg = 4.5): LonLat[] {
  const out: LonLat[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    out.push(a);
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(0, Math.ceil(d / maxDeg) - 1);
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 1);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

function openingNear(lon: number, lat: number, region: GeoRegion): boolean {
  const p: LonLat = [lon, lat];
  for (const o of OPENINGS) {
    if (distDeg(p, [o.lon, o.lat], region) <= o.r) return true;
  }
  return false;
}

export function projectLand(region: GeoRegion): Pt[][] {
  return LAND[region].map((poly) => densify(poly).map(([lon, lat]) => project(lon, lat, region)));
}

export function coastBarriers(region: GeoRegion): { x1: number; y1: number; x2: number; y2: number }[] {
  const walls: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (const raw of LAND[region]) {
    const poly = densify(raw);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const mid: LonLat = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (openingNear(mid[0], mid[1], region)) continue;
      const pa = project(a[0], a[1], region);
      const pb = project(b[0], b[1], region);
      if (Math.hypot(pb.x - pa.x, pb.y - pa.y) < 8) continue;
      walls.push({ x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y });
    }
  }
  return walls;
}

export function pointInPoly(x: number, y: number, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const hit = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

export function onLand(x: number, y: number, land: Pt[][]): boolean {
  for (const poly of land) if (pointInPoly(x, y, poly)) return true;
  return false;
}

export function boundsOf(land: Pt[][]): { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const poly of land) {
    for (const p of poly) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  const pad = 48;
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
}

export function regionOf(id: string): GeoRegion {
  if (id === "slide") return "europe";
  if (id === "culture") return "asia";
  if (id === "royale") return "americas";
  return "world";
}

export function homesFor(region: GeoRegion, count: number): LonLat[] {
  if (region === "world" && count <= 8) return WORLD_COMPACT.slice(0, count);
  const all = HOMES[region];
  return all.slice(0, Math.min(count, all.length));
}
