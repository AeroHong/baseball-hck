import { B2, H, along, angleOf, dist, fenceDist, lerp, pt, startPositions } from '../geometry';
import type { Assignment, Base, Kind, Options, Point, PosKey, Situation } from '../types';
import { BASE_NAME } from '../types';

export type Assignments = Record<PosKey, Assignment>;

/** §5-1 타구 담당자 */
export function fielderFor(kind: Kind, a: number): PosKey {
  if (kind === 'ground') {
    if (a <= -25) return '3B';
    if (a <= -3) return 'SS';
    if (a < 3) return 'P';
    if (a < 25) return '2B';
    return '1B';
  }
  if (a < -12) return 'LF';
  if (a <= 12) return 'CF';
  return 'RF';
}

/** §5-1 타구 지점 */
export function ballPointFor(kind: Kind, a: number): Point {
  const f = fenceDist(a);
  switch (kind) {
    case 'ground':
      return pt(fielderFor('ground', a) === 'P' ? 48 : 108, a);
    case 'single':
      return pt(Math.min(220, f - 90), a);
    case 'fly':
      return pt(Math.min(285, f - 45), a);
    case 'extra':
      return pt(f - 20, a);
    case 'popup':
      return pt(95, a);
    case 'bunt':
      return pt(Math.abs(a) <= 10 ? 28 : 36, a);
  }
}

/** 정면(a=0)은 좌측 취급 */
export const isLeftSide = (a: number) => a <= 0;

/** 타구 쪽 키스톤. 정면(a=0)은 팀 방식(centerKeystone) */
export function keystoneFor(a: number, o: Options): '2B' | 'SS' {
  if (a === 0) return o.centerKeystone;
  return a < 0 ? 'SS' : '2B';
}

/** 인접 외야수: CF 처리면 타구 쪽 코너, 코너면 CF */
export function adjacentOF(handler: PosKey, a: number): PosKey {
  if (handler === 'CF') return isLeftSide(a) ? 'LF' : 'RF';
  return 'CF';
}

/** 반대편 외야수 */
export function oppositeOF(handler: PosKey, a: number): PosKey {
  if (handler === 'LF') return 'RF';
  if (handler === 'RF') return 'LF';
  return isLeftSide(a) ? 'RF' : 'LF';
}

/** 처리 외야수 뒤 30ft 백업 지점. 펜스 밖이면 자기 위치 쪽 옆으로 30ft */
export function backupBehindBall(ball: Point, backerStart: Point): Point {
  const p = along(ball, H, -30);
  if (dist(H, p) > fenceDist(angleOf(p)) - 8) return along(ball, backerStart, 30);
  return p;
}

/** 모든 포지션을 시작 위치 '대기'로 채운 기본 배치 */
export function baseAssignments(s: Situation): Assignments {
  const start = startPositions(s.shift);
  const out = {} as Assignments;
  for (const k of Object.keys(start) as PosKey[]) {
    out[k] = { pos: start[k], role: 'stand', text: '제자리 대기' };
  }
  return out;
}

export function cover(base: Base, p: Point, extra = ''): Assignment {
  return { pos: p, role: 'cover', base, text: `${BASE_NAME[base]} 커버${extra}` };
}

/** 외야수 배치 공통: 처리자 / 인접 백업 / 반대편 2루 방향 45% */
export function placeOutfield(
  as: Assignments,
  s: Situation,
  handler: PosKey,
  ball: Point,
  oppositeMode: 'toward2B' | 'behind2B' | 'stand',
  relayPoint?: Point,
) {
  const start = startPositions(s.shift);
  const adj = adjacentOF(handler, s.angle);
  const opp = oppositeOF(handler, s.angle);
  as[handler] = { pos: ball, role: 'ball', text: '타구 처리 후 중계·목표로 송구' };
  as[adj] = {
    pos: backupBehindBall(ball, start[adj]),
    role: 'back',
    text: `${handler === 'CF' ? '중견수' : handler === 'LF' ? '좌익수' : '우익수'} 뒤 백업, 송구 방향 콜`,
  };
  if (oppositeMode === 'toward2B') {
    as[opp] = { pos: lerp(start[opp], B2, 0.45), role: 'back', text: '2루 방향으로 이동해 뒤로 빠지는 공 대비' };
  } else if (oppositeMode === 'behind2B') {
    const from = relayPoint ?? ball;
    as[opp] = {
      pos: along(from, B2, dist(from, B2) + 30),
      role: 'back',
      base: 'B2',
      text: '빈 2루 뒤 백업 (빠지는 공 차단)',
    };
  } else {
    as[opp] = { pos: start[opp], role: 'stand', text: '포구 확인' };
  }
}
