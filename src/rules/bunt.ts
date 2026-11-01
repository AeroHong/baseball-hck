import { B1, B2, B3, BASES, H, MOUND, along, beyond, pt, startPositions } from '../geometry';
import type { Base, Options, Plan, PosKey, Situation } from '../types';
import { BASE_NAME, POS_NAME } from '../types';
import { baseAssignments, ballPointFor, cover } from './common';

export type BuntSide = '3B' | 'P' | '1B';
export const buntSide = (a: number): BuntSide => (a < -10 ? '3B' : a > 10 ? '1B' : 'P');

/** 주자 1·2루 (만루 제외) & 2아웃 미만 */
const isR12 = (s: Situation) => s.runners[1] && s.runners[2] && !s.runners[3] && s.outs < 2;

/** §12-3 송구 목표 / 대체 목표 */
export function buntTarget(s: Situation): { target: Base; alt?: Base } {
  const r = s.runners;
  if (s.outs === 2 || !(r[1] || r[2] || r[3])) return { target: 'B1' };
  if (r[3]) return { target: 'H', alt: 'B1' };
  if (r[1] && r[2]) return { target: 'B3', alt: 'B1' };
  if (r[1]) return { target: 'B1', alt: 'B2' };
  return { target: 'B1', alt: 'B3' };
}

/** §12-3 번트 수비 */
export function buntPlan(s: Situation, o: Options): Omit<Plan, 'title' | 'warnings' | 'runnerMoves'> {
  const a = s.angle;
  const side = buntSide(a);
  const r12 = isR12(s);
  const rotation = r12 && o.buntPlay === 'rotation';
  const handler: PosKey = side === '3B' && r12 && !rotation ? 'P' : side;
  const ball = ballPointFor('bunt', a);
  const start = startPositions(s.shift);
  const { target, alt } = buntTarget(s);
  const as = baseAssignments(s);

  const charge = (k: '1B' | '3B') => ({
    pos: along(H, start[k], 45),
    role: 'back' as const,
    text: rotation ? '강하게 전진 대시 (로테이션)' : '번트 대비 전진 대시',
  });

  as['1B'] = charge('1B');
  as['3B'] = r12 && !rotation ? cover('B3', B3, ' (3루 포스 대비, 대시하지 않음)') : charge('3B');
  as['2B'] = cover('B1', B1, ' (1루수가 대시)');
  as.SS = rotation ? cover('B3', B3, ' (로테이션 — 3루로 돌아 들어감)') : cover('B2', B2);
  as.C = cover('H', H, ' — 콜: 송구 베이스 지시');
  as.P = rotation
    ? { pos: pt(42, 28), role: 'stand', text: '1루 쪽 라인 담당' }
    : { pos: along(MOUND, H, 15), role: 'stand', text: '마운드에서 홈 쪽 대시' };

  // 외야 백업
  as.RF = { pos: beyond(ball, B1, 40), role: 'back', base: 'B1', text: '1루 송구 뒤 백업' };
  as.CF = { pos: beyond(H, B2, 50), role: 'back', base: 'B2', text: rotation ? '빈 2루 뒤 백업' : '2루 뒤 백업' };
  as.LF = { pos: beyond(B1, B3, 40), role: 'back', base: 'B3', text: '3루 뒤 백업' };

  as[handler] = {
    pos: ball,
    role: 'ball',
    text: `번트 처리 → ${BASE_NAME[target]}${alt ? ` (빠르면 ${BASE_NAME[alt]})` : ''}`,
  };

  const notes: string[] = [];
  if (target === 'H') notes.push('3루 주자 — 스퀴즈 대비, 홈 승부. 늦으면 1루.');
  else if (target === 'B3') notes.push('주자 1·2루 — 3루 포스아웃으로 선행 주자를 잡는다. 늦으면 1루.');
  else if (alt === 'B2') notes.push('주자 1루 — 확실한 1루 아웃이 기본, 타구가 빠르면 2루 선행 주자.');
  else if (alt === 'B3') notes.push('주자 2루 — 1루 아웃이 기본, 3루 송구는 확실할 때만 (태그 플레이).');
  else notes.push('1루로 던져 타자 주자를 잡는다.');
  notes.push(`${POS_NAME[handler]}가 처리, 1루수가 대시하므로 2루수가 1루를 커버한다.`);
  if (rotation) notes.push('로테이션: 1·3루수가 모두 대시하고 유격수가 3루로 돌아 들어간다. 2루는 비고 중견수가 뒤를 막는다.');
  else if (r12) notes.push('기본 수비: 3루수는 3루를 지키고 3루 쪽 번트는 투수가 처리한다.');

  return {
    ballPoint: ball,
    assignments: as,
    throwPath: [ball, BASES[target]],
    cutIndices: [],
    target,
    altThrowPath: alt ? [ball, BASES[alt]] : undefined,
    notes,
  };
}
