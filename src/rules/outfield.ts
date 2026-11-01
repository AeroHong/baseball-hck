import { B1, B2, B3, BASES, H, MOUND, along, beyond, dist } from '../geometry';
import type { Base, Options, Plan, PosKey, Situation } from '../types';
import { BASE_NAME, POS_NAME } from '../types';
import { baseAssignments, ballPointFor, cover, fielderFor, keystoneFor, placeOutfield } from './common';
import { outfieldTarget } from './target';

/** §5-4, §5-5 외야 단타·뜬공 */
export function outfieldPlan(s: Situation, o: Options): Omit<Plan, 'title' | 'warnings' | 'runnerMoves'> & { warnings: string[] } {
  const a = s.angle;
  const handler = fielderFor(s.kind, a);
  const ball = ballPointFor(s.kind, a);
  const target = outfieldTarget(s);
  const as = baseAssignments(s);
  const warnings: string[] = [];
  const notes: string[] = [];

  // 2아웃 뜬공: 송구 없음
  if (target === null) {
    placeOutfield(as, s, handler, ball, 'stand');
    as[handler].text = '포구 = 3아웃';
    for (const k of ['P', 'C', '1B', '2B', '3B', 'SS'] as PosKey[]) as[k].text = '포구 확인 후 철수';
    warnings.push('2아웃 뜬공 — 포구 = 3아웃, 공수 교대. 송구 없음.');
    notes.push(`${POS_NAME[handler]}가 포구하면 이닝 종료.`);
    notes.push('그래도 인접 외야수는 뒤로 백업한다 — 놓치면 장타가 된다.');
    return { ballPoint: ball, assignments: as, throwPath: [ball], cutIndices: [], target: null, notes, warnings };
  }

  placeOutfield(as, s, handler, ball, 'toward2B');
  as.C = cover('H', H);
  const tp = BASES[target];
  let cutter: PosKey;
  let cutPoint;

  if (target === 'H') {
    cutPoint = along(H, ball, 48);
    as.P = { pos: beyond(ball, H, 38), role: 'back', base: 'H', text: '홈 뒤 백업' };
    if (handler === 'LF' && o.homeCutoff === 'split') {
      cutter = '3B';
      as.SS = cover('B3', B3, ' (3루수가 컷오프로 나감)');
      as['2B'] = cover('B2', B2);
      as['1B'] = cover('B1', B1);
    } else {
      cutter = '1B';
      as['3B'] = cover('B3', B3);
      as.SS = cover('B2', B2);
      as['2B'] = cover('B1', B1, ' (1루수가 컷오프로 나감)');
    }
    as.C.text = '홈 커버, 컷오프에게 콜 (커트 / 그대로)';
  } else if (target === 'B3') {
    cutter = 'SS';
    cutPoint = along(B3, ball, 50);
    as['3B'] = cover('B3', B3);
    as['2B'] = cover('B2', B2);
    as['1B'] = cover('B1', B1);
    as.P = { pos: beyond(ball, B3, 36), role: 'back', base: 'B3', text: '3루 뒤 백업' };
  } else {
    cutter = keystoneFor(a, o);
    const other: PosKey = cutter === 'SS' ? '2B' : 'SS';
    cutPoint = along(B2, ball, Math.min(70, dist(B2, ball) * 0.6));
    as[other] = cover('B2', B2);
    as['1B'] = cover('B1', B1);
    as['3B'] = cover('B3', B3);
    as.P = { pos: { x: MOUND.x, y: MOUND.y - 6 }, role: 'stand', text: '마운드 앞 대기' };
  }
  as[cutter] = { pos: cutPoint, role: 'cut', text: `${BASE_NAME[target]} 송구 컷오프 — 콜에 따라 커트 또는 통과` };

  const throwPath = [ball, cutPoint, tp];
  let altThrowPath;

  // notes
  const r = s.runners;
  if (s.kind === 'single') {
    if (target === 'H') notes.push('주자 2루 — 득점을 막기 위해 홈 승부.');
    else if (target === 'B3') notes.push('주자 1루 — 1루 주자의 3루 진루를 막는다.');
    else notes.push('득점권 위협이 없으니 타자 주자 2루 진루만 막는다.');
  } else {
    if (target === 'H') notes.push('주자 3루 태그업 — 홈으로 던진다.');
    else if (target === 'B3') notes.push('주자 2루 태그업 — 3루로 던진다.');
    else notes.push(r[1] ? '1루 주자 태그업 대비 2루로 던진다.' : '타자가 아웃되면 주자 없음 — 2루로 돌려보낸다.');
  }
  if (target === 'H') {
    notes.push(`컷오프는 ${POS_NAME[cutter]}. 키스톤 콤비는 외야로 나가지 않고 베이스를 지킨다.`);
  } else {
    notes.push(`컷오프는 ${POS_NAME[cutter]}, 투수는 ${target === 'B3' ? '3루 뒤 백업' : '마운드 앞 대기'}.`);
  }

  if (s.kind === 'single' && s.outs === 2 && target === 'H') {
    altThrowPath = [cutPoint, B2];
    notes.push('2아웃 — 주자가 타격과 동시에 스타트해 홈 승부가 어렵다. 컷오프가 끊어 타자 주자 2루 진루 저지를 판단.');
  }
  if (s.kind === 'fly' && s.outs < 2) warnings.push('태그업 — 주자는 포구 후 출발.');

  return { ballPoint: ball, assignments: as, throwPath, cutIndices: [1], target: target as Base, altThrowPath, notes, warnings };
}

