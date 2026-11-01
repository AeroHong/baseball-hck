import { B1, B2, B3, BASES, H, MOUND, beyond, lerp, startPositions } from '../geometry';
import type { Options, Plan, Point, Situation } from '../types';
import { BASE_NAME, POS_NAME } from '../types';
import { baseAssignments, ballPointFor, cover, fielderFor } from './common';
import { groundTarget } from './target';

export function grounderPlan(s: Situation, o: Options): Omit<Plan, 'title' | 'warnings'> {
  const a = s.angle;
  const handler = fielderFor('ground', a);
  const ball = ballPointFor('ground', a);
  const tgt = groundTarget(s);
  const start = startPositions(s.shift);
  const as = baseAssignments(s);
  const r = s.runners;

  const throwPath: Point[] = [ball, ...tgt.seq.map((b) => BASES[b])];
  const homeInvolved = tgt.seq.includes('H');
  const dp2B = tgt.seq[0] === 'B2';
  /** b 로 들어오는 마지막 송구의 출발점 */
  const fromFor = (b: Point): Point => {
    const i = throwPath.findIndex((p) => p === b);
    return i > 0 ? throwPath[i - 1] : ball;
  };

  // 타구 처리
  as[handler] = { pos: ball, role: 'ball', text: `타구 처리 → ${tgt.seq.map((b) => BASE_NAME[b]).join(' → ')} 송구` };

  const standMound = { pos: { x: MOUND.x, y: MOUND.y - 6 }, role: 'stand' as const, text: '타구 방향 확인, 다음 플레이 대비' };
  const pivot = dp2B ? ' (병살 피벗)' : '';

  switch (handler) {
    case '3B':
      as.P = standMound;
      as['1B'] = cover('B1', B1);
      as['2B'] = cover('B2', B2, pivot);
      as.SS = r[2]
        ? cover('B3', B3, ' (3루수가 비운 자리)')
        : { pos: beyond(H, ball, 18), role: 'back', text: '3루수 뒤 백업 (빠지는 타구 대비)' };
      break;
    case 'SS':
      as.P = standMound;
      as['1B'] = cover('B1', B1);
      as['2B'] = cover('B2', B2, pivot);
      as['3B'] = cover('B3', B3);
      break;
    case 'P': {
      as['1B'] = cover('B1', B1);
      as['3B'] = cover('B3', B3);
      // 병살 시 2루 커버는 팀 방식(pitcherDpCover), 다른 키스톤은 2루 뒤 백업
      const pv = dp2B ? o.pitcherDpCover : 'SS';
      const other = pv === 'SS' ? '2B' : 'SS';
      as[pv] = cover('B2', B2, pivot);
      as[other] = dp2B
        ? { pos: beyond(ball, B2, 22), role: 'back', base: 'B2', text: '2루 송구 뒤 백업' }
        : { pos: lerp(start[other], B2, 0.5), role: 'stand', text: '2루 근처 대기' };
      break;
    }
    case '2B':
      as['1B'] = cover('B1', B1);
      as.SS = cover('B2', B2, pivot);
      as['3B'] = cover('B3', B3);
      as.P = { pos: lerp(MOUND, B1, 0.55), role: 'back', base: 'B1', text: '1루 쪽 대시, 1루수 커버 확인 후 멈춤' };
      break;
    case '1B':
      as.P = cover('B1', B1, ' (1루수가 타구 처리)');
      as['2B'] = { pos: lerp(start['2B'], B1, 0.6), role: 'back', base: 'B1', text: '1루 쪽 백업' };
      as.SS = cover('B2', B2, pivot);
      as['3B'] = cover('B3', B3);
      break;
  }

  // 포수
  if (r[2] || r[3] || homeInvolved) {
    as.C = cover('H', H, homeInvolved ? ' (홈 송구 받음)' : ' (득점권 주자 대비)');
  } else {
    as.C = { pos: beyond(H, B1, 22), role: 'back', base: 'B1', text: '1루 파울라인 따라 1루 백업' };
  }

  // 외야
  as.RF = { pos: beyond(fromFor(B1), B1, 40), role: 'back', base: 'B1', text: '1루 송구 뒤 백업' };
  as.CF = dp2B
    ? { pos: beyond(ball, B2, 45), role: 'back', base: 'B2', text: '2루 송구 뒤 백업' }
    : { pos: beyond(H, B2, 50), role: 'back', base: 'B2', text: '2루 뒤 백업' };
  as.LF =
    r[2] || r[3]
      ? { pos: beyond(B1, B3, 40), role: 'back', base: 'B3', text: '3루 뒤 백업 (견제·악송구 대비)' }
      : { pos: lerp(start.LF, lerp(B2, B3, 0.5), 0.3), role: 'stand', text: '2·3루 사이 대기' };

  // 상황 요약
  const notes: string[] = [];
  const who = POS_NAME[handler];
  switch (tgt.rule) {
    case 1:
      notes.push('2아웃 — 가장 쉬운 아웃인 1루로 던진다.');
      break;
    case 2:
      notes.push('만루 + 전진 수비 — 홈 포스아웃 후 1루로 병살.');
      break;
    case 3:
      notes.push('3루 주자 + 전진 수비 — 홈으로 던져 태그 플레이로 실점을 막는다.');
      break;
    case 4:
      notes.push('만루 — 홈은 포스 상황이라 홈 → 1루 병살을 노린다.');
      break;
    case 5:
      notes.push('주자 1루, 2아웃 미만 — 2루 → 1루 병살.');
      break;
    case 6:
      notes.push('포스 주자가 없으니 타자 주자를 1루에서 잡는다.');
      break;
  }
  notes.push(`${who}가 처리. ${handler === '1B' ? '1루수가 비우므로 투수가 1루를 커버한다.' : '1루수가 1루를 커버한다.'}`);
  if (dp2B) {
    const pv = as['2B'].base === 'B2' && as['2B'].role === 'cover' ? '2루수' : '유격수';
    notes.push(`2루 커버는 타구 반대쪽 키스톤인 ${pv} — 피벗 후 1루로 송구.`);
  }
  if (as.C.role === 'back') notes.push('홈 플레이가 없으니 포수는 1루 백업을 간다.');

  return { ballPoint: ball, assignments: as, throwPath, cutIndices: [], target: tgt.seq[tgt.seq.length - 1], notes };
}
