import { B1, B2, B3, H, MOUND, beyond, lerp } from '../geometry';
import type { Plan, PosKey, Situation } from '../types';
import { POS_NAME } from '../types';
import { baseAssignments, ballPointFor, cover, fielderFor } from './common';

/** 인필드 플라이 조건: 2아웃 미만 & 주자 1·2루 또는 만루 */
export function isInfieldFly(s: Situation): boolean {
  return s.outs < 2 && s.runners[1] && s.runners[2];
}

function popupHandler(a: number): PosKey {
  if (a <= -25) return '3B';
  if (a < 3) return 'SS'; // 마운드 부근도 유격수 콜, 투수는 양보
  if (a < 25) return '2B';
  return '1B';
}

/** §12-2 내야 뜬공 */
export function popupPlan(s: Situation): Omit<Plan, 'title' | 'runnerMoves'> & { warnings: string[] } {
  const a = s.angle;
  const handler = popupHandler(a);
  const ball = ballPointFor('popup', a);
  const as = baseAssignments(s);
  const warnings: string[] = [];
  const notes: string[] = [];

  as['1B'] = cover('B1', B1, ' (귀루)');
  as['2B'] = cover('B2', B2);
  as.SS = { pos: lerp(as.SS.pos, B2, 0.3), role: 'stand', text: '2루 쪽 대기' };
  as['3B'] = cover('B3', B3, ' (귀루)');
  as.C = cover('H', H);
  as.P = { pos: { x: MOUND.x, y: MOUND.y - 6 }, role: 'stand', text: '콜 — 누가 잡을지 가리켜 지시' };

  switch (handler) {
    case '3B':
      as['3B'] = { pos: ball, role: 'ball', text: '내야 뜬공 포구' };
      as.SS = cover('B3', B3, ' (3루수가 포구하러 나감)');
      break;
    case 'SS':
      as.SS = { pos: ball, role: 'ball', text: '내야 뜬공 포구 (마운드 부근도 유격수 콜)' };
      break;
    case '2B':
      as['2B'] = { pos: ball, role: 'ball', text: '내야 뜬공 포구' };
      as.SS = cover('B2', B2);
      break;
    case '1B':
      as['1B'] = { pos: ball, role: 'ball', text: '내야 뜬공 포구' };
      as.P = cover('B1', B1, ' (1루수가 포구하러 나감)');
      as['2B'] = { pos: lerp(as['2B'].pos, B1, 0.5), role: 'back', base: 'B1', text: '1루수 뒤 백업' };
      as.SS = cover('B2', B2);
      break;
  }

  // 처리자 쪽 외야수가 뒤에서 백업
  const of = fielderFor('single', a);
  as[of] = { pos: beyond(H, ball, 25), role: 'back', text: `${POS_NAME[handler]} 뒤 백업 (놓친 공 대비)` };

  if (isInfieldFly(s)) {
    warnings.push('인필드 플라이 — 타자 자동 아웃. 주자는 진루 의무 없음 (리터치 후 진루는 가능).');
    notes.push('2아웃 전 주자 1·2루(또는 만루)의 내야 뜬공 — 고의 낙구 병살을 막기 위한 인필드 플라이 규칙.');
  }
  if (s.outs === 2) warnings.push('2아웃 내야 뜬공 — 포구 = 3아웃, 공수 교대.');
  notes.push(`${POS_NAME[handler]}가 포구. 투수는 직접 잡지 않고 콜로 정리한다.`);
  notes.push('나머지 내야수는 자기 베이스로 돌아가 주자의 리터치·진루에 대비한다.');

  return { ballPoint: ball, assignments: as, throwPath: [ball], cutIndices: [], target: null, notes, warnings };
}
