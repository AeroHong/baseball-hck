import { describe, expect, it } from 'vitest';
import { dist, startPositions } from '../src/geometry';
import { candidates, grade, makeQuestion, seededRandom } from '../src/quiz';
import { computePlan } from '../src/rules';
import { DEFAULT_OPTIONS } from '../src/types';

describe('퀴즈 (§12-5)', () => {
  it('문제 수비수는 커버·중계·백업 역할이고 15ft 이상 움직인다 (시드 500개)', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const q = makeQuestion(DEFAULT_OPTIONS, seededRandom(seed));
      const plan = computePlan(q.situation);
      const a = plan.assignments[q.fielder];
      expect(['cover', 'cut', 'back'], `seed ${seed}`).toContain(a.role);
      expect(dist(startPositions(q.situation.shift)[q.fielder], a.pos), `seed ${seed}`).toBeGreaterThanOrEqual(15);
    }
  });

  it('병살 시프트는 주자 1루 & 2아웃 미만일 때만', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const { situation: s } = makeQuestion(DEFAULT_OPTIONS, seededRandom(seed));
      if (s.shift === 'dp') expect(s.runners[1] && s.outs < 2, `seed ${seed}`).toBe(true);
      expect(s.shift === 'in', `seed ${seed}`).toBe(false);
    }
  });

  it('같은 시드 = 같은 문제', () => {
    expect(makeQuestion(DEFAULT_OPTIONS, seededRandom(42))).toEqual(makeQuestion(DEFAULT_OPTIONS, seededRandom(42)));
  });

  it('여러 타구 종류가 고르게 나온다', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) kinds.add(makeQuestion(DEFAULT_OPTIONS, seededRandom(seed)).situation.kind);
    expect(kinds.size).toBe(6);
  });

  it('후보 예: 좌익 단타 주자 2루 → 3루수(컷오프) 포함', () => {
    const c = candidates({ kind: 'single', angle: -27, runners: { 1: false, 2: true, 3: false }, outs: 1, shift: 'normal' }, DEFAULT_OPTIONS);
    expect(c).toContain('3B');
  });

  it('채점: 12ft 이내 정답, 30ft 이내 근접, 그 외 오답', () => {
    const ans = { x: 0, y: 100 };
    expect(grade({ x: 0, y: 110 }, ans)).toMatchObject({ grade: 'correct' });
    expect(grade({ x: 0, y: 125 }, ans)).toMatchObject({ grade: 'close' });
    expect(grade({ x: 0, y: 140 }, ans)).toMatchObject({ grade: 'wrong' });
    expect(grade({ x: 3, y: 104 }, ans).error).toBeCloseTo(5);
  });
});
