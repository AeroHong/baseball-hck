import { dist, startPositions } from './geometry';
import { DIRECTIONS, computePlan } from './rules';
import type { Kind, Options, Point, PosKey, Situation } from './types';
import { POS_KEYS } from './types';

export interface Question {
  situation: Situation;
  fielder: PosKey;
}

export type Grade = 'correct' | 'close' | 'wrong';

export const CORRECT_FT = 12;
export const CLOSE_FT = 30;
const MIN_MOVE_FT = 15;

const KINDS: Kind[] = ['ground', 'single', 'fly', 'extra', 'popup', 'bunt'];
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

/** §12-5 무작위 문제. rand 를 넘기면 결정적으로 만들 수 있다 (테스트용) */
export function makeQuestion(options: Options, rand: () => number = Math.random): Question {
  for (let tries = 0; tries < 100; tries++) {
    const m = Math.floor(rand() * 8);
    const runners = { 1: !!(m & 1), 2: !!(m & 2), 3: !!(m & 4) };
    const outs = pick([0, 1, 2] as const, rand);
    const shift = runners[1] && outs < 2 && rand() < 0.5 ? 'dp' : 'normal';
    const situation: Situation = { kind: pick(KINDS, rand), angle: pick(DIRECTIONS, rand).angle, runners, outs, shift };
    const c = candidates(situation, options);
    if (c.length) return { situation, fielder: pick(c, rand) };
  }
  // 이론상 도달하지 않음: 항상 후보가 있는 고정 문제
  return {
    situation: { kind: 'single', angle: -27, runners: { 1: false, 2: true, 3: false }, outs: 1, shift: 'normal' },
    fielder: '3B',
  };
}

export function grade(guess: Point, answer: Point): { grade: Grade; error: number } {
  const error = dist(guess, answer);
  return { grade: error <= CORRECT_FT ? 'correct' : error <= CLOSE_FT ? 'close' : 'wrong', error };
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
