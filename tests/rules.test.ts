import { describe, expect, it } from 'vitest';
import { B1, B2, B3, H, dist, insidePlayable } from '../src/geometry';
import { computePlan } from '../src/rules';
import type { Kind, Plan, Point, PosKey, Situation, Shift } from '../src/types';
import { POS_KEYS } from '../src/types';

function sit(p: Partial<Situation> & { r?: (1 | 2 | 3)[] }): Situation {
  const r = p.r ?? [];
  return {
    kind: p.kind ?? 'ground',
    angle: p.angle ?? 0,
    runners: { 1: r.includes(1), 2: r.includes(2), 3: r.includes(3) },
    outs: p.outs ?? 0,
    shift: p.shift ?? 'normal',
  };
}

const same = (p: Point, q: Point) => dist(p, q) < 0.01;
const last = (plan: Plan) => plan.throwPath[plan.throwPath.length - 1];
const role = (plan: Plan, k: PosKey) => plan.assignments[k].role;
const coverOf = (plan: Plan, k: PosKey) =>
  plan.assignments[k].role === 'cover' ? plan.assignments[k].base : undefined;
const cutters = (plan: Plan) => POS_KEYS.filter((k) => role(plan, k) === 'cut');

describe('내야 땅볼', () => {
  it('1. a=-30 주자 없음 0아웃: 3B 처리, 1B 커버, C·RF 1루 백업, 끝=B1', () => {
    const p = computePlan(sit({ angle: -30 }));
    expect(role(p, '3B')).toBe('ball');
    expect(coverOf(p, '1B')).toBe('B1');
    expect(p.assignments.C).toMatchObject({ role: 'back', base: 'B1' });
    expect(p.assignments.RF).toMatchObject({ role: 'back', base: 'B1' });
    expect(same(last(p), B1)).toBe(true);
  });

  it('2. a=30 주자 없음: 1B 처리, P 1루 커버', () => {
    const p = computePlan(sit({ angle: 30 }));
    expect(role(p, '1B')).toBe('ball');
    expect(coverOf(p, 'P')).toBe('B1');
  });

  it('3. a=-15 주자 1루 0아웃: SS 처리, 2B 2루 커버, 경로 B2→B1', () => {
    const p = computePlan(sit({ angle: -15, r: [1] }));
    expect(role(p, 'SS')).toBe('ball');
    expect(coverOf(p, '2B')).toBe('B2');
    expect(p.throwPath.slice(1)).toEqual([B2, B1]);
  });

  it('4. a=15 주자 1루 1아웃: 2B 처리, SS 2루 커버, 병살', () => {
    const p = computePlan(sit({ angle: 15, r: [1], outs: 1 }));
    expect(role(p, '2B')).toBe('ball');
    expect(coverOf(p, 'SS')).toBe('B2');
    expect(p.throwPath.slice(1)).toEqual([B2, B1]);
    expect(p.assignments.SS.text).toContain('피벗');
  });

  it('5. a=15 주자 1루 2아웃: 끝=B1, 병살 아님', () => {
    const p = computePlan(sit({ angle: 15, r: [1], outs: 2 }));
    expect(p.throwPath.slice(1)).toEqual([B1]);
  });

  it('6. a=-15 주자 3루 0아웃 전진: 끝=H', () => {
    const p = computePlan(sit({ angle: -15, r: [3], shift: 'in' }));
    expect(p.target).toBe('H');
    expect(same(last(p), H)).toBe(true);
  });

  it('16. a=0 주자 없음: P 처리, 1B 1루, SS 2루, 2B 대기, C 1루 백업', () => {
    const p = computePlan(sit({ angle: 0 }));
    expect(role(p, 'P')).toBe('ball');
    expect(coverOf(p, '1B')).toBe('B1');
    expect(coverOf(p, 'SS')).toBe('B2');
    expect(role(p, '2B')).toBe('stand');
    expect(p.assignments.C).toMatchObject({ role: 'back', base: 'B1' });
  });

  it('17. a=-30 주자 2루 0아웃: SS 3루 커버, LF 3루 뒤 백업, C 홈, 끝=B1', () => {
    const p = computePlan(sit({ angle: -30, r: [2] }));
    expect(role(p, '3B')).toBe('ball');
    expect(coverOf(p, 'SS')).toBe('B3');
    expect(p.assignments.LF).toMatchObject({ role: 'back', base: 'B3' });
    expect(coverOf(p, 'C')).toBe('H');
    expect(same(last(p), B1)).toBe(true);
  });

  it('23. a=60 입력은 45로 클램프되어 1B 처리', () => {
    const p = computePlan(sit({ angle: 60 }));
    expect(role(p, '1B')).toBe('ball');
  });
});

describe('외야 단타·뜬공', () => {
  it('7. 단타 a=-27 주자 2루: 컷오프 3B, SS 3루 커버, P 홈 뒤', () => {
    const p = computePlan(sit({ kind: 'single', angle: -27, r: [2] }));
    expect(p.target).toBe('H');
    expect(cutters(p)).toEqual(['3B']);
    expect(coverOf(p, 'SS')).toBe('B3');
    expect(p.assignments.P).toMatchObject({ role: 'back', base: 'H' });
  });

  it('8. 단타 a=27 주자 2루: 컷오프 1B, 2B 1루 커버, P 홈 뒤', () => {
    const p = computePlan(sit({ kind: 'single', angle: 27, r: [2] }));
    expect(cutters(p)).toEqual(['1B']);
    expect(coverOf(p, '2B')).toBe('B1');
    expect(p.assignments.P).toMatchObject({ role: 'back', base: 'H' });
  });

  it('9. 단타 a=27 주자 1루: 목표 B3, 컷오프 SS, P 3루 뒤', () => {
    const p = computePlan(sit({ kind: 'single', angle: 27, r: [1] }));
    expect(p.target).toBe('B3');
    expect(cutters(p)).toEqual(['SS']);
    expect(p.assignments.P).toMatchObject({ role: 'back', base: 'B3' });
  });

  it('10. 단타 a=-14 주자 없음: 목표 B2, SS 나감, 2B 2루 커버', () => {
    const p = computePlan(sit({ kind: 'single', angle: -14 }));
    expect(p.target).toBe('B2');
    expect(cutters(p)).toEqual(['SS']);
    expect(coverOf(p, '2B')).toBe('B2');
  });

  it('11. 뜬공 a=0 주자 3루 1아웃: 목표 H', () => {
    const p = computePlan(sit({ kind: 'fly', angle: 0, r: [3], outs: 1 }));
    expect(p.target).toBe('H');
  });

  it('12. 뜬공 a=0 주자 3루 2아웃: 송구 없음, 공수 교대 경고', () => {
    const p = computePlan(sit({ kind: 'fly', angle: 0, r: [3], outs: 2 }));
    expect(p.target).toBeNull();
    expect(p.warnings?.join(' ')).toContain('공수 교대');
  });

  it('19. 단타 a=-27 주자 2루 2아웃: 대체 경로 컷오프→B2', () => {
    const p = computePlan(sit({ kind: 'single', angle: -27, r: [2], outs: 2 }));
    expect(p.target).toBe('H');
    expect(p.altThrowPath).toBeDefined();
    expect(same(p.altThrowPath![0], p.assignments['3B'].pos)).toBe(true);
    expect(same(p.altThrowPath![p.altThrowPath!.length - 1], B2)).toBe(true);
  });

  it('20. 단타 a=-27 주자 2루 1아웃: 대체 경로 없음', () => {
    const p = computePlan(sit({ kind: 'single', angle: -27, r: [2], outs: 1 }));
    expect(p.altThrowPath).toBeUndefined();
  });

  it('21. 뜬공 a=0 주자 3루 2아웃: throwPath 길이 1', () => {
    const p = computePlan(sit({ kind: 'fly', angle: 0, r: [3], outs: 2 }));
    expect(p.throwPath).toHaveLength(1);
    expect(Object.keys(p.assignments)).toHaveLength(9);
  });

  it('22. 단타 a=0 주자 없음: CF 처리, LF 백업, SS 나감, 2B 2루 커버', () => {
    const p = computePlan(sit({ kind: 'single', angle: 0 }));
    expect(role(p, 'CF')).toBe('ball');
    expect(role(p, 'LF')).toBe('back');
    expect(cutters(p)).toEqual(['SS']);
    expect(coverOf(p, '2B')).toBe('B2');
  });
});

describe('장타', () => {
  it('13. a=-40 주자 1루: SS 릴레이, 2B 트레일러, 1B 컷오프, 목표 H', () => {
    const p = computePlan(sit({ kind: 'extra', angle: -40, r: [1] }));
    expect(p.target).toBe('H');
    expect(same(p.throwPath[1], p.assignments.SS.pos)).toBe(true);
    expect(role(p, '2B')).toBe('cut');
    expect(same(p.throwPath[2], p.assignments['1B'].pos)).toBe(true);
    expect(p.cutIndices).toEqual([1, 2]);
  });

  it('14. a=27 주자 없음: 2B 릴레이, 목표 B3, 1B 2루 커버', () => {
    const p = computePlan(sit({ kind: 'extra', angle: 27 }));
    expect(p.target).toBe('B3');
    expect(same(p.throwPath[1], p.assignments['2B'].pos)).toBe(true);
    expect(coverOf(p, '1B')).toBe('B2');
    expect(same(last(p), B3)).toBe(true);
  });

  it('18. a=-40 주자 1루: 2루 커버 없음, RF 2루 뒤 백업, notes에 2루', () => {
    const p = computePlan(sit({ kind: 'extra', angle: -40, r: [1] }));
    expect(POS_KEYS.some((k) => coverOf(p, k) === 'B2')).toBe(false);
    expect(p.assignments.RF).toMatchObject({ role: 'back', base: 'B2' });
    expect(p.notes.join(' ')).toContain('2루');
  });
});

describe('15. 불변 조건 — 전수 검사', () => {
  const kinds: Kind[] = ['ground', 'single', 'fly', 'extra'];
  const angles = [-40, -27, -14, 0, 14, 27, 40];
  const shifts: Shift[] = ['normal', 'dp', 'in'];
  const all: Situation[] = [];
  for (const kind of kinds)
    for (const angle of angles)
      for (let m = 0; m < 8; m++)
        for (const outs of [0, 1, 2] as const)
          for (const shift of shifts)
            all.push({ kind, angle, outs, shift, runners: { 1: !!(m & 1), 2: !!(m & 2), 3: !!(m & 4) } });

  it('상황 2,016개', () => expect(all).toHaveLength(2016));

  it('모든 Plan이 §4 불변 조건 만족', () => {
    for (const s of all) {
      const p = computePlan(s);
      const ctx = JSON.stringify(s);
      expect(Object.keys(p.assignments).sort(), ctx).toEqual([...POS_KEYS].sort());
      expect(POS_KEYS.filter((k) => role(p, k) === 'ball'), ctx).toHaveLength(1);
      const covered = POS_KEYS.filter((k) => role(p, k) === 'cover').map((k) => p.assignments[k].base);
      expect(covered.every(Boolean), ctx).toBe(true);
      expect(new Set(covered).size, ctx).toBe(covered.length);
      expect(p.throwPath.length, ctx).toBeGreaterThanOrEqual(1);
      expect(p.throwPath[0], ctx).toBe(p.ballPoint);
      expect(p.target === null, ctx).toBe(p.throwPath.length === 1);
      for (const k of POS_KEYS) {
        const { x, y } = p.assignments[k].pos;
        expect(Number.isFinite(x) && Number.isFinite(y), `${ctx} ${k}`).toBe(true);
        expect(insidePlayable(p.assignments[k].pos), `${ctx} ${k} 경기장 밖 (${x.toFixed(0)},${y.toFixed(0)})`).toBe(true);
      }
      expect(p.notes.length, ctx).toBeGreaterThanOrEqual(1);
      for (const q of [...p.throwPath, ...(p.altThrowPath ?? [])]) expect(insidePlayable(q), `${ctx} 경로점`).toBe(true);
    }
  });
});

describe('경기장 경계', () => {
  it('파울 지역은 안, 관중석·펜스 밖은 밖', () => {
    expect(insidePlayable({ x: 100, y: 55 })).toBe(true); // 1루 뒤 파울 지역
    expect(insidePlayable({ x: 0, y: -40 })).toBe(true); // 홈 뒤 백스톱 앞
    expect(insidePlayable({ x: 0, y: -70 })).toBe(false); // 백스톱 뒤
    expect(insidePlayable({ x: 200, y: 40 })).toBe(false); // 1루 쪽 관중석
    expect(insidePlayable({ x: 0, y: 410 })).toBe(false); // 중앙 펜스 밖
    expect(insidePlayable({ x: 0, y: 390 })).toBe(true);
  });
});

import { applyClick, fromQuery, interpretClick, toQuery } from '../src/situation';

describe('그라운드 클릭 · URL', () => {
  const base = sit({ kind: 'ground', angle: 0 });
  it('베이스 근처 클릭 = 주자 토글', () => {
    const c = interpretClick({ x: 60, y: 66 });
    expect(c).toEqual({ type: 'base', base: 1 });
    expect(applyClick(base, c).runners[1]).toBe(true);
  });
  it('외야 클릭: 땅볼이었으면 단타로, 방향은 스냅', () => {
    const s = applyClick(base, interpretClick({ x: -150, y: 200 }));
    expect(s.kind).toBe('single');
    expect(s.angle).toBe(-40);
  });
  it('외야 클릭: 뜬공은 뜬공 유지', () => {
    const s = applyClick({ ...base, kind: 'fly' }, interpretClick({ x: 0, y: 250 }));
    expect(s.kind).toBe('fly');
    expect(s.angle).toBe(0);
  });
  it('내야 클릭 = 땅볼', () => {
    const s = applyClick({ ...base, kind: 'extra' }, interpretClick({ x: 40, y: 100 }));
    expect(s.kind).toBe('ground');
    expect(s.angle).toBe(27);
  });
  it('파울 지역·홈 뒤 클릭은 무시', () => {
    expect(interpretClick({ x: 100, y: 40 })).toBeNull();
    expect(interpretClick({ x: 0, y: -20 })).toBeNull();
  });
  it('URL 왕복', () => {
    const s = sit({ kind: 'extra', angle: 14, r: [1, 3], outs: 2, shift: 'in' });
    expect(fromQuery(toQuery(s))).toEqual(s);
  });
  it('잘못된 URL 값은 기본값으로', () => {
    const s = fromQuery('?k=bunt&a=abc&o=7&s=x');
    expect(s.kind).toBe('single');
    expect([0, 1, 2]).toContain(s.outs);
  });
});
