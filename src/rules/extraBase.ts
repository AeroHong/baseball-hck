import { B2, B3, BASES, H, along, beyond, dist } from '../geometry';
import type { Plan, PosKey, Situation } from '../types';
import { baseAssignments, ballPointFor, cover, fielderFor, placeOutfield } from './common';
import { extraTarget } from './target';

/** §5-6 장타 — 탠덤 릴레이 */
export function extraBasePlan(s: Situation): Omit<Plan, 'title' | 'warnings'> {
  const a = s.angle;
  const handler = fielderFor('extra', a);
  const ball = ballPointFor('extra', a);
  const target = extraTarget(s);
  const tp = BASES[target];
  const as = baseAssignments(s);

  const relayMan: PosKey = a > 0 ? '2B' : 'SS';
  const trailer: PosKey = relayMan === 'SS' ? '2B' : 'SS';
  const relay = along(ball, tp, Math.min(150, dist(ball, tp) * 0.5));
  const trail = along(relay, tp, 35);

  as[relayMan] = { pos: relay, role: 'cut', text: '1차 중계(릴레이맨) — 외야수 송구를 받아 목표로' };
  as[trailer] = { pos: trail, role: 'cut', text: '2차 중계(트레일러) — 릴레이맨 뒤, 송구 방향 콜' };
  as['3B'] = cover('B3', B3);
  as.C = cover('H', H);

  const notes: string[] = [];
  const throwPath = [ball, relay];
  const cutIndices = [1];

  if (target === 'H') {
    placeOutfield(as, s, handler, ball, 'behind2B', relay);
    const cut = along(H, relay, 46);
    as['1B'] = { pos: cut, role: 'cut', text: '홈 컷오프 — 릴레이 → 홈 라인 위' };
    as.P = { pos: beyond(cut, H, 38), role: 'back', base: 'H', text: '홈 뒤 백업' };
    as.C.text = '홈 커버, 컷오프에게 콜';
    throwPath.push(cut, H);
    cutIndices.push(2);
    notes.push('주자가 있는 장타 — 득점을 막기 위해 홈까지 탠덤 릴레이.');
    notes.push('2루는 비워 둔다 — 득점 저지가 우선, 타자 주자의 2루 진루는 감수. 반대편 외야수가 2루 뒤만 막는다.');
  } else {
    placeOutfield(as, s, handler, ball, 'toward2B');
    as['1B'] = cover('B2', B2, ' (타자 주자 따라감)');
    as.P = { pos: beyond(relay, B3, 36), role: 'back', base: 'B3', text: '3루 뒤 백업' };
    throwPath.push(B3);
    notes.push('주자 없는 장타 — 타자 주자의 3루타를 막는다.');
    notes.push('키스톤 둘이 중계로 나가 1루수가 타자 주자를 따라 2루를 커버한다.');
  }
  notes.unshift(`${relayMan === 'SS' ? '유격수' : '2루수'}가 릴레이맨, ${trailer === 'SS' ? '유격수' : '2루수'}가 트레일러.`);

  return { ballPoint: ball, assignments: as, throwPath, cutIndices, target, notes };
}
