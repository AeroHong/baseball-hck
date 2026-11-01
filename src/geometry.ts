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
