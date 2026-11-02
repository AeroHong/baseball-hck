import { clampAngle } from '../geometry';
import type { Kind, Options, Plan, Situation } from '../types';
import { DEFAULT_OPTIONS } from '../types';
import { buntPlan, buntSide } from './bunt';
import { extraBasePlan } from './extraBase';
import { grounderPlan } from './grounder';
import { outfieldPlan } from './outfield';
import { pickoffPlan, stealPlan, wildPitchPlan, wildSide } from './pitchPlays';
import { popupPlan } from './popup';
import { runnerMoves } from './runners';

export const KIND_NAME: Record<Kind, string> = {
  ground: '땅볼', single: '단타', fly: '뜬공', extra: '장타', popup: '내야 뜬공', bunt: '번트',
  steal: '도루 저지', pickoff: '견제', wildpitch: '폭투·포일',
};

const WILD_SIDE_NAME = { '3B': '3루 쪽', C: '정면', '1B': '1루 쪽' } as const;

const BUNT_SIDE_NAME = { '3B': '3루 쪽', P: '투수 앞', '1B': '1루 쪽' } as const;

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
  if (s.kind === 'steal' || s.kind === 'pickoff') return `${s.outs}아웃 · ${runnersLabel(s)} · ${KIND_NAME[s.kind]}`;
  const where =
    s.kind === 'bunt'
      ? BUNT_SIDE_NAME[buntSide(s.angle)]
      : s.kind === 'wildpitch'
        ? WILD_SIDE_NAME[wildSide(s.angle)]
        : directionLabel(s.angle);
  return `${s.outs}아웃 · ${runnersLabel(s)} · ${where} ${KIND_NAME[s.kind]}`;
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

function kindPlan(s: Situation, o: Options): Omit<Plan, 'title' | 'warnings' | 'runnerMoves'> & { warnings?: string[] } {
  switch (s.kind) {
    case 'ground':
      return grounderPlan(s, o);
    case 'extra':
      return extraBasePlan(s, o);
    case 'popup':
      return popupPlan(s);
    case 'bunt':
      return buntPlan(s, o);
    case 'steal':
      return stealPlan(s, o);
    case 'pickoff':
      return pickoffPlan(s, o);
    case 'wildpitch':
      return wildPitchPlan(s);
    default:
      return outfieldPlan(s, o);
  }
}

export function computePlan(input: Situation, options: Options = DEFAULT_OPTIONS): Plan {
  const s: Situation = { ...input, angle: clampAngle(input.angle) };
  const base = kindPlan(s, options);
  const warnings = [...(base.warnings ?? []), ...shiftWarnings(s)];
  return {
    ...base,
    title: situationTitle(s),
    runnerMoves: runnerMoves(s, base.target),
    warnings: warnings.length ? warnings : undefined,
  };
}
