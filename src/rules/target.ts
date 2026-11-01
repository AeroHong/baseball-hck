import type { Base, Situation } from '../types';

export interface GroundTarget {
  /** 송구 순서 (병살이면 2개) */
  seq: Base[];
  doublePlay: boolean;
  rule: 1 | 2 | 3 | 4 | 5 | 6;
}

export const isLoaded = (s: Situation) => s.runners[1] && s.runners[2] && s.runners[3];
export const anyRunner = (s: Situation) => s.runners[1] || s.runners[2] || s.runners[3];

/** §5-2 내야 땅볼 송구 목표 (우선순위 순) */
export function groundTarget(s: Situation): GroundTarget {
  const r = s.runners;
  if (s.outs === 2) return { seq: ['B1'], doublePlay: false, rule: 1 };
  if (r[3] && s.shift === 'in' && isLoaded(s)) return { seq: ['H', 'B1'], doublePlay: true, rule: 2 };
  if (r[3] && s.shift === 'in') return { seq: ['H'], doublePlay: false, rule: 3 };
  if (isLoaded(s)) return { seq: ['H', 'B1'], doublePlay: true, rule: 4 };
  if (r[1]) return { seq: ['B2', 'B1'], doublePlay: true, rule: 5 };
  return { seq: ['B1'], doublePlay: false, rule: 6 };
}

/** §5-4 외야 단타·뜬공 목표. 송구 없음은 null */
export function outfieldTarget(s: Situation): Base | null {
  const r = s.runners;
  if (s.kind === 'single') {
    if (r[2]) return 'H';
    if (r[1]) return 'B3';
    return 'B2';
  }
  // fly
  if (s.outs === 2) return null;
  if (r[3]) return 'H';
  if (r[2]) return 'B3';
  return 'B2';
}

/** §5-6 장타 목표 */
export function extraTarget(s: Situation): Base {
  return anyRunner(s) ? 'H' : 'B3';
}
