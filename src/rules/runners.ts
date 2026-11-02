import type { Base, RunnerMove, Situation } from '../types';
import { buntTarget } from './bunt';
import { pickoffTarget, stealTarget, wildTarget } from './pitchPlays';
import { groundTarget } from './target';

const ORDER: Base[] = ['H', 'B1', 'B2', 'B3', 'H'];
const BASE_OF: Record<1 | 2 | 3, Base> = { 1: 'B1', 2: 'B2', 3: 'B3' };

/** from 에서 n 베이스 진루하는 경로 (최대 홈) */
export function advance(from: Base, n: number): Base[] {
  const i = from === 'H' ? 0 : ORDER.indexOf(from);
  return ORDER.slice(i, Math.min(i + n, 4) + 1);
}

const lastOf = (p: Base[]) => p[p.length - 1];

/** 포스 상태: 1루 주자는 항상, 2루는 1루가 차 있으면, 3루는 1·2루가 차 있으면 */
function forced(s: Situation, b: 1 | 2 | 3): boolean {
  const r = s.runners;
  if (b === 1) return true;
  if (b === 2) return r[1];
  return r[1] && r[2];
}

/** §12-4 주자 이동. target 은 Plan 의 최종 송구 목표 */
export function runnerMoves(s: Situation, target: Base | null): RunnerMove[] {
  const r = s.runners;
  const on = ([1, 2, 3] as const).filter((b) => r[b]);
  const moves: RunnerMove[] = [];
  const add = (id: RunnerMove['id'], path: Base[], result: RunnerMove['result']) => moves.push({ id, path, result });
  const hold = (b: 1 | 2 | 3) => add(b, [BASE_OF[b]], 'hold');

  switch (s.kind) {
    case 'ground': {
      const { seq, rule } = groundTarget(s);
      add('batter', ['H', 'B1'], seq.includes('B1') ? 'out' : 'safe');
      for (const b of on) {
        if (forced(s, b)) {
          const path = advance(BASE_OF[b], 1);
          add(b, path, lastOf(path) === seq[0] && seq[0] !== 'B1' ? 'out' : 'safe');
        } else if (b === 3 && rule === 3) {
          add(b, ['B3', 'H'], 'attempt'); // 전진 수비 홈 태그 승부
        } else hold(b);
      }
      break;
    }
    case 'single': {
      const two = s.outs === 2;
      add('batter', ['H', 'B1'], 'safe');
      if (r[1]) add(1, advance('B1', target === 'B3' || two ? 2 : 1), target === 'B3' ? 'attempt' : 'safe');
      if (r[2]) add(2, advance('B2', 2), 'attempt');
      if (r[3]) add(3, advance('B3', 1), 'safe');
      break;
    }
    case 'fly': {
      add('batter', ['H', 'B1'], 'out');
      for (const b of on) {
        if (s.outs === 2) add(b, advance(BASE_OF[b], 1), 'safe');
        else if (target && lastOf(advance(BASE_OF[b], 1)) === target) add(b, advance(BASE_OF[b], 1), 'attempt');
        else hold(b);
      }
      break;
    }
    case 'extra': {
      add('batter', target === 'B3' ? advance('H', 3) : advance('H', 2), target === 'B3' ? 'attempt' : 'safe');
      if (r[1]) add(1, advance('B1', 3), 'attempt');
      if (r[2]) add(2, advance('B2', 2), 'safe');
      if (r[3]) add(3, advance('B3', 1), 'safe');
      break;
    }
    case 'popup': {
      add('batter', ['H'], 'out');
      for (const b of on) hold(b);
      break;
    }
    case 'bunt': {
      const t = buntTarget(s).target;
      add('batter', ['H', 'B1'], t === 'B1' ? 'out' : 'safe');
      for (const b of on) {
        const path = advance(BASE_OF[b], 1);
        if (forced(s, b)) add(b, path, lastOf(path) === t && t !== 'B1' ? 'out' : 'safe');
        else if (b === 3 && t === 'H') add(b, path, 'attempt'); // 스퀴즈
        else add(b, path, 'safe'); // 희생번트로 진루
      }
      break;
    }
    case 'steal': {
      // 타자는 달리지 않는다. 도루 주자 attempt, 더블 스틸이면 뒤 주자도 진루
      const t = stealTarget(s);
      for (const b of on) {
        const next = lastOf(advance(BASE_OF[b], 1));
        if (t && next === t) add(b, advance(BASE_OF[b], 1), 'attempt');
        else if (t === 'B3' && b === 1) add(b, advance('B1', 1), 'safe'); // 1·2루 더블 스틸
        else hold(b);
      }
      break;
    }
    case 'pickoff': {
      const t = pickoffTarget(s);
      for (const b of on) add(b, [BASE_OF[b]], BASE_OF[b] === t ? 'attempt' : 'hold'); // 귀루 승부
      break;
    }
    case 'wildpitch': {
      const t = wildTarget(s);
      for (const b of on) {
        const path = advance(BASE_OF[b], 1);
        add(b, path, lastOf(path) === t ? 'attempt' : 'safe');
      }
      break;
    }
  }
  return moves;
}
