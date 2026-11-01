import type { Base, Point, PosKey, Shift } from './types';

const RAD = Math.PI / 180;

/** 홈에서 거리 d, 각도 a(도) 지점. 중견 0°, 좌측 음수 */
export function pt(d: number, a: number): Point {
  return { x: d * Math.sin(a * RAD), y: d * Math.cos(a * RAD) };
}

export function dist(p: Point, q: Point): number {
  return Math.hypot(q.x - p.x, q.y - p.y);
}

export function lerp(p: Point, q: Point, k: number): Point {
  return { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k };
}

/** from 에서 to 방향으로 d 만큼. 음수면 반대쪽 */
export function along(from: Point, to: Point, d: number): Point {
  const L = dist(from, to);
  if (L === 0) return { ...from };
  return lerp(from, to, d / L);
}

/** from → p 연장선에서 p 를 지나 d 만큼 더 간 지점 (백업 위치 계산용) */
export function beyond(from: Point, p: Point, d: number): Point {
  return along(from, p, dist(from, p) + d);
}

/** 홈 기준 방향각(도) */
export function angleOf(p: Point): number {
  return Math.atan2(p.x, p.y) / RAD;
}

/** 펜스 거리: 좌우 330, 중앙 400 */
export function fenceDist(a: number): number {
  return 330 + 70 * Math.cos(2 * a * RAD);
}

export function clampAngle(a: number): number {
  return Math.max(-45, Math.min(45, a));
}

export const H: Point = { x: 0, y: 0 };
export const B1: Point = { x: 63.6, y: 63.6 };
export const B2: Point = { x: 0, y: 127.3 };
export const B3: Point = { x: -63.6, y: 63.6 };
export const MOUND: Point = { x: 0, y: 60.5 };

export const BASES: Record<Base, Point> = { H, B1, B2, B3 };

export const DEFAULT_POS: Record<PosKey, Point> = {
  P: { x: 0, y: 60.5 },
  C: { x: 0, y: -7 },
  '1B': { x: 74, y: 96 },
  '2B': { x: 40, y: 146 },
  '3B': { x: -74, y: 96 },
  SS: { x: -40, y: 146 },
  LF: { x: -152, y: 255 },
  CF: { x: 0, y: 300 },
  RF: { x: 152, y: 255 },
};

/** 시프트를 반영한 시작 위치 */
export function startPositions(shift: Shift): Record<PosKey, Point> {
  const p: Record<PosKey, Point> = { ...DEFAULT_POS };
  if (shift === 'dp') {
    // 2루 쪽으로 10ft, 앞으로 8ft
    p['2B'] = { x: DEFAULT_POS['2B'].x - 10, y: DEFAULT_POS['2B'].y - 8 };
    p.SS = { x: DEFAULT_POS.SS.x + 10, y: DEFAULT_POS.SS.y - 8 };
  } else if (shift === 'in') {
    // 내야 잔디 경계 근처로 전진
    for (const k of ['1B', '2B', '3B', 'SS'] as const) {
      p[k] = along(DEFAULT_POS[k], H, 22);
    }
  }
  return p;
}

/* ── 경기장 경계 (페어 + 파울 지역) ───────────────────────── */

/** 홈 뒤 백스톱까지 거리 */
export const BACKSTOP = 55;
/** 파울 라인 ~ 관중석 벽 거리: 홈 근처 55ft → 코너 20ft 로 좁아짐 */
export const CORNER_FOUL = 20;

export function foulWidth(s: number): number {
  const k = Math.max(0, Math.min(1, s / 330));
  return BACKSTOP + (CORNER_FOUL - BACKSTOP) * k;
}

const S = Math.SQRT1_2;
const U_L: Point = { x: -S, y: S }; // 좌측 파울 라인 방향
const U_R: Point = { x: S, y: S };
const N_L: Point = { x: -S, y: -S }; // 좌측 파울 라인 바깥쪽 법선
const N_R: Point = { x: S, y: -S };
const comb = (u: Point, a: number, n: Point, b: number): Point => ({ x: u.x * a + n.x * b, y: u.y * a + n.y * b });

let playableCache: Point[] | null = null;

/** 경기장(플레이 가능 지역) 외곽 다각형: 외야 펜스 → 우측 관중석 벽 → 백스톱 → 좌측 벽 */
export function playablePolygon(): Point[] {
  if (playableCache) return playableCache;
  const pts: Point[] = [];
  for (let a = -45; a <= 45; a += 1) pts.push(pt(fenceDist(a), a));
  for (let s = 330; s >= 0; s -= 15) pts.push(comb(U_R, s, N_R, foulWidth(s)));
  for (let th = -45; th >= -135; th -= 5) pts.push({ x: BACKSTOP * Math.cos(th * RAD), y: BACKSTOP * Math.sin(th * RAD) });
  for (let s = 0; s <= 330; s += 15) pts.push(comb(U_L, s, N_L, foulWidth(s)));
  playableCache = pts;
  return pts;
}

/** p 가 경기장 안(파울 지역 포함)인지 */
export function insidePlayable(p: Point): boolean {
  const poly = playablePolygon();
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** 폴리라인 위 비율 k(0~1) 지점 */
export function pointAlong(path: Point[], k: number): Point {
  if (path.length === 1) return path[0];
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const d = dist(path[i - 1], path[i]);
    seg.push(d);
    total += d;
  }
  let target = Math.max(0, Math.min(1, k)) * total;
  for (let i = 0; i < seg.length; i++) {
    if (target <= seg[i] || i === seg.length - 1) return lerp(path[i], path[i + 1], seg[i] ? Math.min(1, target / seg[i]) : 1);
    target -= seg[i];
  }
  return path[path.length - 1];
}
