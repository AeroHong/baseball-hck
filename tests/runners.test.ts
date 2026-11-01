import { describe, expect, it } from 'vitest';
import { computePlan } from '../src/rules';
import { advance } from '../src/rules/runners';
import type { Base, Kind, RunnerMove, Situation } from '../src/types';

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
const mv = (s: Situation, id: RunnerMove['id']) => computePlan(s).runnerMoves.find((m) => m.id === id);
const end = (m?: RunnerMove) => m?.path[m.path.length - 1];

describe('advance', () => {
  it('베이스 진루 경로', () => {
    expect(advance('B1', 1)).toEqual(['B1', 'B2']);
    expect(advance('B2', 2)).toEqual(['B2', 'B3', 'H']);
    expect(advance('B3', 3)).toEqual(['B3', 'H']); // 홈에서 멈춤
    expect(advance('H', 2)).toEqual(['H', 'B1', 'B2']);
  });
});

describe('주자 이동 (§12-4)', () => {
  it('병살 땅볼: 1루 주자 2루 아웃, 타자 1루 아웃', () => {
    const s = sit({ angle: -14, r: [1] });
    expect(mv(s, 1)).toMatchObject({ path: ['B1', 'B2'], result: 'out' });
    expect(mv(s, 'batter')).toMatchObject({ path: ['H', 'B1'], result: 'out' });
  });
  it('땅볼 주자 2루만: 2루 주자 hold', () => {
    expect(mv(sit({ angle: -14, r: [2] }), 2)).toMatchObject({ path: ['B2'], result: 'hold' });
  });
  it('전진 수비 홈 송구: 3루 주자 홈 시도', () => {
    expect(mv(sit({ angle: -14, r: [3], shift: 'in' }), 3)).toMatchObject({ path: ['B3', 'H'], result: 'attempt' });
  });
  it('만루 땅볼: 3루 주자 홈 포스아웃', () => {
    expect(mv(sit({ angle: -14, r: [1, 2, 3] }), 3)).toMatchObject({ path: ['B3', 'H'], result: 'out' });
  });
  it('단타 주자 2루: 홈 시도, 타자 1루 세이프', () => {
    const s = sit({ kind: 'single', angle: -27, r: [2] });
    expect(mv(s, 2)).toMatchObject({ path: ['B2', 'B3', 'H'], result: 'attempt' });
    expect(mv(s, 'batter')).toMatchObject({ result: 'safe' });
  });
  it('우익 단타 주자 1루: 3루 시도', () => {
    expect(mv(sit({ kind: 'single', angle: 27, r: [1] }), 1)).toMatchObject({ path: ['B1', 'B2', 'B3'], result: 'attempt' });
  });
  it('뜬공 주자 3루 1아웃: 태그업 홈 시도, 타자 아웃', () => {
    const s = sit({ kind: 'fly', r: [3], outs: 1 });
    expect(mv(s, 3)).toMatchObject({ path: ['B3', 'H'], result: 'attempt' });
    expect(mv(s, 'batter')?.result).toBe('out');
  });
  it('장타 주자 1루: 홈 시도, 타자 2루', () => {
    const s = sit({ kind: 'extra', angle: -40, r: [1] });
    expect(mv(s, 1)).toMatchObject({ path: ['B1', 'B2', 'B3', 'H'], result: 'attempt' });
    expect(end(mv(s, 'batter'))).toBe('B2');
  });
  it('장타 주자 없음: 타자 3루 시도', () => {
    expect(mv(sit({ kind: 'extra', angle: 27 }), 'batter')).toMatchObject({ path: ['H', 'B1', 'B2', 'B3'], result: 'attempt' });
  });
  it('내야 뜬공: 타자 아웃, 주자 hold', () => {
    const s = sit({ kind: 'popup', r: [1, 2] });
    expect(mv(s, 'batter')?.result).toBe('out');
    expect(mv(s, 1)?.result).toBe('hold');
  });
  it('번트 주자 1·2루: 2루 주자 3루 포스아웃, 1루 주자 2루, 타자 세이프', () => {
    const s = sit({ kind: 'bunt', angle: -27, r: [1, 2] });
    expect(mv(s, 2)).toMatchObject({ path: ['B2', 'B3'], result: 'out' });
    expect(mv(s, 1)).toMatchObject({ path: ['B1', 'B2'], result: 'safe' });
    expect(mv(s, 'batter')?.result).toBe('safe');
  });
  it('번트 주자 3루: 스퀴즈 시도', () => {
    expect(mv(sit({ kind: 'bunt', r: [3] }), 3)).toMatchObject({ path: ['B3', 'H'], result: 'attempt' });
  });
});

describe('주자 이동 불변 조건 — 전수', () => {
  const kinds: Kind[] = ['ground', 'single', 'fly', 'extra', 'popup', 'bunt'];
  const ORDER: Base[] = ['H', 'B1', 'B2', 'B3', 'H'];
  it('타자 1명 + 주자 수만큼, 경로는 연속 베이스, 살아남은 주자끼리 같은 베이스에 서지 않음', () => {
    for (const kind of kinds)
      for (const angle of [-40, -27, -14, 0, 14, 27, 40])
        for (let m = 0; m < 8; m++)
          for (const outs of [0, 1, 2] as const)
            for (const shift of ['normal', 'dp', 'in'] as const) {
              const s: Situation = { kind, angle, outs, shift, runners: { 1: !!(m & 1), 2: !!(m & 2), 3: !!(m & 4) } };
              const moves = computePlan(s).runnerMoves;
              const ctx = JSON.stringify(s);
              const count = 1 + [1, 2, 3].filter((b) => s.runners[b as 1 | 2 | 3]).length;
              expect(moves, ctx).toHaveLength(count);
              for (const mvv of moves) {
                const start = mvv.id === 'batter' ? 0 : mvv.id;
                expect(mvv.path[0], ctx).toBe(ORDER[start]);
                mvv.path.forEach((b, i) => expect(b, ctx).toBe(ORDER[start + i]));
              }
              const standing = moves
                .filter((x) => x.result === 'safe' || x.result === 'hold')
                .map((x) => x.path[x.path.length - 1])
                .filter((b) => b !== 'H');
              expect(new Set(standing).size, `${ctx} 겹침 ${standing}`).toBe(standing.length);
            }
  });
});
