/**
 * §13 타구가 아닌 플레이: 도루 저지 · 견제 · 폭투/포일.
 * 공은 투수 투구(마운드)에서 시작한다 → Plan.ballFrom = MOUND.
 */
import { B1, B2, B3, BASES, H, MOUND, along, beyond, lerp, startPositions } from '../geometry';
import type { Base, Options, Plan, Point, Situation } from '../types';
import { POS_NAME } from '../types';
import { baseAssignments, cover } from './common';

type PitchPlan = Omit<Plan, 'title' | 'runnerMoves'> & { warnings: string[] };

/** 포수 포구 지점 */
export const CATCH_POINT: Point = { x: 0, y: -3 };

const other = (k: 'SS' | '2B'): 'SS' | '2B' => (k === 'SS' ? '2B' : 'SS');

/* ── 도루 저지 ───────────────────────────────────────── */

/** 도루 목표: 1루 주자(2루 비어 있음) → 2루, 2루 주자(3루 비어 있음) → 3루(선행 주자 우선) */
export function stealTarget(s: Situation): Base | null {
  const r = s.runners;
  if (r[2] && !r[3]) return 'B3';
  if (r[1] && !r[2]) return 'B2';
  return null;
}

export function stealPlan(s: Situation, o: Options): PitchPlan {
  const as = baseAssignments(s);
  const start = startPositions(s.shift);
  const ball = CATCH_POINT;
  const target = stealTarget(s);
  const notes: string[] = [];
  const warnings: string[] = [];
  as.C = { pos: ball, role: 'ball', text: '포구 즉시 일어나 송구' };
  as.P = { pos: { x: MOUND.x, y: MOUND.y - 4 }, role: 'stand', text: '투구 후 몸을 낮춰 송구 길 비우기' };

  if (!target) {
    as.C = { pos: ball, role: 'ball', text: '포구 — 도루 시도 없음' };
    warnings.push(
      s.runners[1] || s.runners[2] || s.runners[3]
        ? '다음 베이스가 차 있거나 3루 주자뿐이라 일반적인 도루 상황이 아니다.'
        : '주자가 없어 도루 상황이 아니다. 주자를 1루나 2루에 놓아 보세요.',
    );
    notes.push('도루는 1루 주자(2루 비었을 때) 또는 2루 주자(3루 비었을 때)가 시도한다.');
    return { ballPoint: ball, ballFrom: MOUND, assignments: as, throwPath: [ball], cutIndices: [], target: null, notes, warnings };
  }

  const coverer = o.stealCover;
  const helper = other(coverer);

  if (target === 'B2') {
    as[coverer] = cover('B2', B2, ' (태그 준비, 베이스 앞쪽에 서기)');
    as.CF = { pos: beyond(ball, B2, 70), role: 'back', base: 'B2', text: '2루 뒤 백업 (빠지는 송구 차단)' };
    as['3B'] = cover('B3', B3, ' (악송구 때 3루 진루 대비)');
    as['1B'] = { pos: along(B1, H, 6), role: 'stand', text: '견제 위치에서 대기, 송구 후 1루로' };
    as.RF = { pos: lerp(start.RF, B2, 0.3), role: 'back', base: 'B2', text: '2루 쪽으로 이동해 뒤로 빠지는 공 대비' };
    as.LF = { pos: lerp(start.LF, B3, 0.25), role: 'stand', text: '3루 쪽으로 조금 이동' };

    if (s.runners[3] && s.outs < 2) {
      // 1·3루 더블 스틸 대비: 키스톤 한 명이 2루 앞에서 커트
      const cut = along(B2, H, 30);
      as[helper] = { pos: cut, role: 'cut', text: '2루 앞 커트 — 3루 주자가 뛰면 끊어서 홈 송구' };
      notes.push(`1·3루 더블 스틸 대비: ${POS_NAME[helper]}가 2루 앞 30ft에서 커트맨. 3루 주자가 홈으로 뛰면 끊어서 홈으로 던진다.`);
      notes.push('3루 주자가 움직이지 않으면 커트하지 않고 그대로 2루에서 태그.');
      as['3B'] = cover('B3', B3, ' (3루 주자 견제, 리드 폭 줄이기)');
      return {
        ballPoint: ball,
        ballFrom: MOUND,
        assignments: as,
        throwPath: [ball, cut, B2],
        cutIndices: [1],
        target: 'B2',
        altThrowPath: [cut, H],
        notes,
        warnings,
      };
    }
    as[helper] = { pos: beyond(ball, B2, 18), role: 'back', base: 'B2', text: '2루 바로 뒤 백업' };
    notes.push(`포수 → 2루. ${POS_NAME[coverer]}가 커버하고 ${POS_NAME[helper]}·중견수가 뒤를 막는다.`);
    notes.push(`2루 커버는 보통 우타자일 때 유격수, 좌타자일 때 2루수 (팀 방식에서 변경).`);
  } else {
    // 3루 도루
    as['3B'] = cover('B3', B3, ' (태그 준비)');
    as.LF = { pos: beyond(ball, B3, 45), role: 'back', base: 'B3', text: '3루 뒤 백업 (빠지는 송구 차단)' };
    as.SS = { pos: lerp(start.SS, B3, 0.45), role: 'back', base: 'B3', text: '3루 쪽으로 이동해 백업' };
    as['2B'] = cover('B2', B2, s.runners[1] ? ' (1루 주자 더블 스틸 대비)' : ' (빈 2루)');
    as['1B'] = s.runners[1]
      ? { pos: along(B1, H, 6), role: 'stand', text: '1루 주자 견제 위치에서 대기' }
      : cover('B1', B1);
    as.CF = { pos: lerp(start.CF, B2, 0.35), role: 'back', base: 'B2', text: '2루 쪽으로 이동해 백업' };
    notes.push('포수 → 3루. 3루수가 커버하고 좌익수가 3루 뒤 파울 지역까지 백업한다.');
    if (s.runners[1]) notes.push('1·2루 더블 스틸 — 선행 주자(3루)를 잡는 것이 원칙.');
    notes.push('3루 도루는 짧은 송구라 포수 송구가 빠르지만, 빠지면 바로 실점이라 백업이 중요하다.');
  }
  if (s.outs === 2) warnings.push('2아웃 — 도루 아웃이면 이닝 종료.');
  return { ballPoint: ball, ballFrom: MOUND, assignments: as, throwPath: [ball, BASES[target]], cutIndices: [], target, notes, warnings };
}

/* ── 견제 ────────────────────────────────────────────── */

/** 견제 대상: 1루 주자(2루 비었을 때) → 1루, 아니면 2루 주자 → 2루, 3루 주자 → 3루 */
export function pickoffTarget(s: Situation): Base | null {
  const r = s.runners;
  if (r[1] && !r[2]) return 'B1';
  if (r[2]) return 'B2';
  if (r[3]) return 'B3';
  return null;
}

export function pickoffPlan(s: Situation, o: Options): PitchPlan {
  const as = baseAssignments(s);
  const start = startPositions(s.shift);
  const ball = MOUND;
  const target = pickoffTarget(s);
  const notes: string[] = [];
  const warnings: string[] = [];
  as.P = { pos: ball, role: 'ball', text: '세트 포지션에서 견제 송구' };
  as.C = { pos: { x: 0, y: -5 }, role: 'stand', text: '견제 사인 · 대기' };

  if (!target) {
    warnings.push('주자가 없어 견제할 베이스가 없다. 주자를 놓아 보세요.');
    notes.push('견제는 주자의 리드 폭을 줄이고 도루 스타트를 늦추는 플레이.');
    return { ballPoint: ball, ballFrom: ball, assignments: as, throwPath: [ball], cutIndices: [], target: null, notes, warnings };
  }

  if (target === 'B1') {
    as['1B'] = cover('B1', B1, ' (베이스에 붙어 태그 준비)');
    as.RF = { pos: beyond(ball, B1, 45), role: 'back', base: 'B1', text: '1루 뒤 파울 지역 백업' };
    as['2B'] = { pos: lerp(start['2B'], B1, 0.35), role: 'back', base: 'B1', text: '1루 쪽으로 이동해 빠지는 공 대비' };
    as.SS = cover('B2', B2, ' (악송구 때 주자 진루 대비)');
    notes.push('투수 → 1루 견제. 1루수가 베이스에서 태그, 우익수가 1루 뒤 파울 지역을 막는다.');
    notes.push('견제 악송구는 파울 지역으로 굴러가므로 우익수 백업이 없으면 주자가 3루까지 간다.');
  } else if (target === 'B2') {
    const coverer = o.stealCover;
    const helper = other(coverer);
    as[coverer] = cover('B2', B2, ' (투수와 약속한 타이밍에 들어옴)');
    as[helper] = { pos: lerp(start[helper], B2, 0.5), role: 'back', base: 'B2', text: '2루 쪽으로 붙어 백업 · 주자 리드 압박' };
    as.CF = { pos: beyond(ball, B2, 60), role: 'back', base: 'B2', text: '2루 뒤로 전진해 백업' };
    notes.push(`투수 → 2루 견제. ${POS_NAME[coverer]}가 들어가고 중견수가 2루 뒤로 달려와 막는다.`);
    notes.push('2루 견제는 사인 플레이 — 투수가 돌아서는 타이밍과 커버가 들어오는 타이밍을 맞춘다.');
    if (s.runners[1]) {
      as['1B'] = { pos: lerp(start['1B'], B1, 0.6), role: 'stand', text: '1루 주자 뒤쪽 수비 위치' };
    }
  } else {
    as['3B'] = cover('B3', B3, ' (베이스에 붙어 태그 준비)');
    as.LF = { pos: beyond(ball, B3, 45), role: 'back', base: 'B3', text: '3루 뒤 파울 지역 백업' };
    as.SS = { pos: lerp(start.SS, B3, 0.35), role: 'back', base: 'B3', text: '3루 쪽으로 이동해 빠지는 공 대비' };
    notes.push('투수 → 3루 견제. 악송구는 곧 실점이라 좌익수가 반드시 3루 뒤 파울 지역을 막는다.');
    notes.push('우투수는 3루 견제 동작이 커서 자주 쓰지 않는다. 리드 폭이 크거나 스퀴즈가 의심될 때.');
  }
  if (s.runners[3] && target !== 'B3') {
    notes.push('3루 주자가 있으면 견제 악송구 = 실점. 송구는 낮고 정확하게.');
  }
  return { ballPoint: ball, ballFrom: ball, assignments: as, throwPath: [ball, BASES[target]], cutIndices: [], target, notes, warnings };
}

/* ── 폭투 · 포일 ─────────────────────────────────────── */

export type WildSide = '3B' | 'C' | '1B';
export function wildSide(a: number): WildSide {
  if (a < -10) return '3B';
  if (a > 10) return '1B';
  return 'C';
}

const WILD_SIDE_X: Record<WildSide, number> = { '3B': -30, C: 0, '1B': 30 };

/** 공이 백스톱 앞에서 멈춘 지점 */
export function wildBallPoint(a: number): Point {
  return { x: WILD_SIDE_X[wildSide(a)], y: -42 };
}

/** 송구 목표: 3루 주자 → 홈 / 2루 주자 → 3루 / 1루 주자 → 2루 */
export function wildTarget(s: Situation): Base | null {
  if (s.runners[3]) return 'H';
  if (s.runners[2]) return 'B3';
  if (s.runners[1]) return 'B2';
  return null;
}

export function wildPitchPlan(s: Situation): PitchPlan {
  const as = baseAssignments(s);
  const start = startPositions(s.shift);
  const ball = wildBallPoint(s.angle);
  const target = wildTarget(s);
  const notes: string[] = [];
  const warnings: string[] = [];
  as.C = { pos: ball, role: 'ball', text: '공을 쫓아가 잡고 송구' };

  if (!target) {
    warnings.push('주자가 없어 진루 플레이가 없다 (스트라이크아웃 낫아웃이면 1루 송구).');
    as.P = { pos: { x: 0, y: 40 }, role: 'stand', text: '홈 쪽으로 나와 상황 확인' };
    notes.push('폭투·포일은 주자가 있을 때 진루를 막는 플레이.');
    return { ballPoint: ball, ballFrom: MOUND, assignments: as, throwPath: [ball], cutIndices: [], target: null, notes, warnings };
  }

  // 투수는 항상 홈 커버 (주자 3루가 아니어도 추가 진루 대비)
  as.P = cover('H', { x: 0, y: 2 }, ' (홈 플레이트 앞, 주자 쪽에서 태그)');
  as['1B'] = { pos: beyond(ball, H, 30), role: 'back', base: 'H', text: '홈 앞쪽 백업 (투수가 놓친 공 대비)' };

  if (s.runners[2] || target === 'B3') as['3B'] = cover('B3', B3);
  else as['3B'] = { pos: lerp(start['3B'], H, 0.4), role: 'back', base: 'H', text: '홈 쪽으로 이동해 백업' };
  if (s.runners[1] || s.runners[2]) as.SS = cover('B2', B2);
  if (s.runners[1]) as['2B'] = { pos: lerp(start['2B'], B1, 0.5), role: 'stand', text: '1루 쪽 대기' };

  if (target === 'H') {
    notes.push('3루 주자 홈 쇄도 — 포수가 공을 잡아 홈 커버 들어온 투수에게 토스.');
    notes.push('투수는 홈 플레이트 앞(3루 쪽)에서 주자를 기다리고, 1루수가 그 뒤를 받친다.');
  } else if (target === 'B3') {
    as.LF = { pos: beyond(ball, B3, 40), role: 'back', base: 'B3', text: '3루 뒤 백업' };
    notes.push('2루 주자가 3루로 — 포수 → 3루 송구, 좌익수 3루 뒤 백업. 투수는 홈 커버.');
  } else {
    as.CF = { pos: beyond(ball, B2, 60), role: 'back', base: 'B2', text: '2루 뒤 백업' };
    notes.push('1루 주자가 2루로 — 무리한 2루 송구보다 공을 확실히 잡는 게 우선.');
  }
  notes.push('폭투(투수 책임)와 포일(포수 책임)은 기록만 다르고 수비 움직임은 같다.');
  return { ballPoint: ball, ballFrom: MOUND, assignments: as, throwPath: [ball, BASES[target]], cutIndices: [], target, notes, warnings };
}

export const isPitchPlay = (k: Situation['kind']) => k === 'steal' || k === 'pickoff' || k === 'wildpitch';
