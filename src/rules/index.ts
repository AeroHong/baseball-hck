import { clampAngle } from '../geometry';
import type { Kind, Plan, Situation } from '../types';
import { extraBasePlan } from './extraBase';
import { grounderPlan } from './grounder';
import { outfieldPlan } from './outfield';

export const KIND_NAME: Record<Kind, string> = {
  ground: '땅볼', single: '단타', fly: '뜬공', extra: '장타',
};

export const DIRECTIONS = [
  { label: '좌선상', angle: -40 },
  { label: '좌익', angle: -27 },
  { label: '좌중간', angle: -14 },
  { label: '중견', angle: 0 },
  { label: '우중간', angle: 14 },
  { label: '우익', angle: 27 },
  { label: '우선상', angle: 40 },
] as const;

export function directionLabel(a: number): string {
  let best: (typeof DIRECTIONS)[number] = DIRECTIONS[0];
  for (const d of DIRECTIONS) if (Math.abs(d.angle - a) < Math.abs(best.angle - a)) best = d;
  return best.label;
}

export function runnersLabel(s: Situation): string {
  const r = s.runners;
  if (r[1] && r[2] && r[3]) return '만루';
  const on = [1, 2, 3].filter((b) => r[b as 1 | 2 | 3]);
  return on.length === 0 ? '주자 없음' : `주자 ${on.join('·')}루`;
}

export function situationTitle(s: Situation): string {
  return `${s.outs}아웃 · ${runnersLabel(s)} · ${directionLabel(s.angle)} ${KIND_NAME[s.kind]}`;
}

/** §5-0 시프트 유효성 경고 */
function shiftWarnings(s: Situation): string[] {
  const w: string[] = [];
  if (s.shift === 'dp' && !(s.runners[1] && s.outs < 2)) {
    w.push('병살 시프트는 주자 1루 & 2아웃 미만일 때만 의미가 있다.');
  }
  if (s.shift === 'in' && !s.runners[3]) {
    w.push('전진 수비는 주자 3루일 때 의미가 있다.');
  }
  return w;
}

export function computePlan(input: Situation): Plan {
  const s: Situation = { ...input, angle: clampAngle(input.angle) };
  const base =
    s.kind === 'ground' ? grounderPlan(s) : s.kind === 'extra' ? extraBasePlan(s) : outfieldPlan(s);
  const warnings = [...((base as { warnings?: string[] }).warnings ?? []), ...shiftWarnings(s)];
  return {
    ...base,
    title: situationTitle(s),
    warnings: warnings.length ? warnings : undefined,
  };
}
