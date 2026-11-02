import { dist, startPositions } from './geometry';
import { DIRECTIONS, computePlan } from './rules';
import type { Kind, Options, Point, PosKey, Situation } from './types';
import { KINDS, POS_KEYS } from './types';

export interface Question {
  situation: Situation;
  fielder: PosKey;
}

export type Grade = 'correct' | 'close' | 'wrong';
export type Difficulty = 'easy' | 'normal' | 'hard';

/** 난이도별 채점 기준(ft). 쉬움은 역할 힌트도 보여 준다 */
export const THRESHOLDS: Record<Difficulty, { correct: number; close: number }> = {
  easy: { correct: 15, close: 35 },
  normal: { correct: 12, close: 30 },
  hard: { correct: 8, close: 20 },
};
export const DIFFICULTY_NAME: Record<Difficulty, string> = { easy: '쉬움', normal: '보통', hard: '어려움' };

/** 하위 호환: 보통 난이도 기준 */
export const CORRECT_FT = THRESHOLDS.normal.correct;
export const CLOSE_FT = THRESHOLDS.normal.close;

/** 문제당 점수 */
export const POINTS: Record<Grade, number> = { correct: 10, close: 5, wrong: 0 };
export const MAX_POINTS = POINTS.correct;

const MIN_MOVE_FT = 15;

export const QUIZ_KINDS: Kind[] = KINDS;
const pick = <T,>(arr: readonly T[], rand: () => number): T => arr[Math.floor(rand() * arr.length) % arr.length];

/** 문제 수비수 후보: 커버·중계·백업 역할이면서 시작 위치에서 15ft 이상 움직이는 수비수 */
export function candidates(s: Situation, options: Options): PosKey[] {
  const plan = computePlan(s, options);
  const start = startPositions(s.shift);
  return POS_KEYS.filter((k) => {
    const a = plan.assignments[k];
    return (a.role === 'cover' || a.role === 'cut' || a.role === 'back') && dist(start[k], a.pos) >= MIN_MOVE_FT;
  });
}

function randomSituation(rand: () => number): Situation {
  const m = Math.floor(rand() * 8);
  const runners = { 1: !!(m & 1), 2: !!(m & 2), 3: !!(m & 4) };
  const outs = pick([0, 1, 2] as const, rand);
  const shift = runners[1] && outs < 2 && rand() < 0.5 ? 'dp' : 'normal';
  return { kind: pick(QUIZ_KINDS, rand), angle: pick(DIRECTIONS, rand).angle, runners, outs, shift };
}

/** 전체 상황 목록 (특정 포지션 문제가 드물 때 대비) */
function allSituations(): Situation[] {
  const out: Situation[] = [];
  for (const kind of QUIZ_KINDS)
    for (const d of DIRECTIONS)
      for (let m = 0; m < 8; m++)
        for (const outs of [0, 1, 2] as const) {
          const runners = { 1: !!(m & 1), 2: !!(m & 2), 3: !!(m & 4) };
          out.push({ kind, angle: d.angle, runners, outs, shift: 'normal' });
          if (runners[1] && outs < 2) out.push({ kind, angle: d.angle, runners, outs, shift: 'dp' });
        }
  return out;
}

/**
 * §12-5 무작위 문제. position 을 주면 그 수비수가 움직이는 상황만 낸다 (포지션 맞춤 퀴즈).
 * rand 를 넘기면 결정적으로 만들 수 있다 (테스트용)
 */
export function makeQuestion(options: Options, rand: () => number = Math.random, position: PosKey | null = null): Question {
  for (let tries = 0; tries < 300; tries++) {
    const situation = randomSituation(rand);
    const c = candidates(situation, options);
    if (position) {
      if (c.includes(position)) return { situation, fielder: position };
    } else if (c.length) return { situation, fielder: pick(c, rand) };
  }
  // 드문 포지션(포수 등): 전수에서 고른다
  const pool = allSituations().filter((s) => {
    const c = candidates(s, options);
    return position ? c.includes(position) : c.length > 0;
  });
  if (pool.length) {
    const situation = pick(pool, rand);
    return { situation, fielder: position ?? pick(candidates(situation, options), rand) };
  }
  return {
    situation: { kind: 'single', angle: -27, runners: { 1: false, 2: true, 3: false }, outs: 1, shift: 'normal' },
    fielder: '3B',
  };
}

const questionKey = (q: Question) => `${q.fielder}|${JSON.stringify(q.situation)}`;

/** 한 판(count 문제). 같은 문제는 되도록 겹치지 않게 */
export function makeRun(
  options: Options,
  count: number,
  position: PosKey | null = null,
  rand: () => number = Math.random,
): Question[] {
  const out: Question[] = [];
  const seen = new Set<string>();
  for (let tries = 0; out.length < count && tries < count * 20; tries++) {
    const q = makeQuestion(options, rand, position);
    const key = questionKey(q);
    if (seen.has(key) && tries < count * 10) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

export function grade(guess: Point, answer: Point, difficulty: Difficulty = 'normal'): { grade: Grade; error: number } {
  const error = dist(guess, answer);
  const t = THRESHOLDS[difficulty];
  return { grade: error <= t.correct ? 'correct' : error <= t.close ? 'close' : 'wrong', error };
}

/** 테스트·재현용 결정적 난수 (mulberry32) */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
