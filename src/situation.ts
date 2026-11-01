import { B1, B2, B3, angleOf, dist } from './geometry';
import { DIRECTIONS } from './rules';
import type { Kind, Point, Shift, Situation } from './types';

export const DEFAULT_SITUATION: Situation = {
  kind: 'single',
  angle: -27,
  runners: { 1: false, 2: true, 3: false },
  outs: 1,
  shift: 'normal',
};

/** 그라운드 클릭 결과 */
export type FieldClick = { type: 'base'; base: 1 | 2 | 3 } | { type: 'direction'; angle: number; infield: boolean } | null;

const BASE_HIT_RADIUS = 12;
const INFIELD_RADIUS = 135;

export function snapAngle(a: number): number {
  let best: number = DIRECTIONS[0].angle;
  for (const d of DIRECTIONS) if (Math.abs(d.angle - a) < Math.abs(best - a)) best = d.angle;
  return best;
}

/** 필드 좌표(ft) 클릭을 해석: 베이스 근처 → 주자 토글, 페어 지역 → 방향, 그 외 무시 */
export function interpretClick(p: Point): FieldClick {
  const bases = [
    [1, B1],
    [2, B2],
    [3, B3],
  ] as const;
  for (const [b, bp] of bases) if (dist(p, bp) <= BASE_HIT_RADIUS) return { type: 'base', base: b };
  const d = Math.hypot(p.x, p.y);
  const a = angleOf(p);
  if (d < 15 || p.y <= 0 || Math.abs(a) > 45) return null;
  return { type: 'direction', angle: snapAngle(a), infield: d <= INFIELD_RADIUS };
}

/** 클릭을 상황에 반영 (§7) */
export function applyClick(s: Situation, c: FieldClick): Situation {
  if (!c) return s;
  if (c.type === 'base') return { ...s, runners: { ...s.runners, [c.base]: !s.runners[c.base] } };
  // 내야 클릭: 내야 타구(땅볼·내야 뜬공·번트)는 유지, 외야 타구면 땅볼로
  // 외야 클릭: 내야 타구였으면 단타로, 외야 타구는 유지
  const infieldKind = s.kind === 'ground' || s.kind === 'popup' || s.kind === 'bunt';
  let kind: Kind = s.kind;
  if (c.infield && !infieldKind) kind = 'ground';
  else if (!c.infield && infieldKind) kind = 'single';
  return { ...s, kind, angle: c.angle };
}

/* ── URL 쿼리 ↔ 상황 (공유용) ───────────────────────────── */

const KINDS: Kind[] = ['ground', 'single', 'fly', 'extra', 'popup', 'bunt'];
const SHIFTS: Shift[] = ['normal', 'dp', 'in'];

export function toQuery(s: Situation): string {
  const r = [1, 2, 3].filter((b) => s.runners[b as 1 | 2 | 3]).join('') || '0';
  return new URLSearchParams({ k: s.kind, a: String(s.angle), r, o: String(s.outs), s: s.shift }).toString();
}

export function fromQuery(q: string): Situation {
  const p = new URLSearchParams(q);
  const kind = KINDS.find((k) => k === p.get('k')) ?? DEFAULT_SITUATION.kind;
  const rawA = Number(p.get('a'));
  const angle = p.has('a') && Number.isFinite(rawA) ? snapAngle(rawA) : DEFAULT_SITUATION.angle;
  const r = p.get('r');
  const runners = r === null ? DEFAULT_SITUATION.runners : { 1: r.includes('1'), 2: r.includes('2'), 3: r.includes('3') };
  const o = Number(p.get('o'));
  const outs = p.has('o') && (o === 0 || o === 1 || o === 2) ? o : DEFAULT_SITUATION.outs;
  const shift = SHIFTS.find((x) => x === p.get('s')) ?? DEFAULT_SITUATION.shift;
  return { kind, angle, runners, outs, shift };
}
