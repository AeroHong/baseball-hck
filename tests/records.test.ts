import { describe, expect, it } from 'vitest';
import type { Grade } from '../src/quiz';
import {
  EMPTY_STORE,
  RANK_MIN_QUESTIONS,
  addSession,
  leaderboard,
  parseStore,
  mergeLegacy,
  playerKey,
  playerStats,
  removePlayer,
  scoreRate,
  tally,
  upsertPlayer,
  weakest,
  type AnswerRecord,
  type RecordStore,
} from '../src/records';
import type { PosKey, Situation } from '../src/types';

const S: Situation = { kind: 'single', angle: -27, runners: { 1: false, 2: true, 3: false }, outs: 1, shift: 'normal' };
const ans = (grade: Grade, fielder: PosKey = '3B', kind: Situation['kind'] = 'single'): AnswerRecord => ({
  situation: { ...S, kind },
  fielder,
  grade,
  error: 5,
});

function withPlayer(store: RecordStore, name: string) {
  const r = upsertPlayer(store, name, null);
  return { store: r.store, id: r.player.id };
}

function play(store: RecordStore, id: string, grades: Grade[], extra: Partial<{ retry: boolean; date: number }> = {}) {
  return addSession(store, {
    playerId: id,
    date: extra.date ?? Date.now(),
    position: null,
    difficulty: 'normal',
    retry: extra.retry ?? false,
    answers: grades.map((g) => ans(g)),
  });
}

describe('기록 · 대시보드', () => {
  it('점수: 정답 10 · 근접 5 · 오답 0, 점수율 반올림', () => {
    const t = tally([ans('correct'), ans('close'), ans('wrong')]);
    expect(t).toMatchObject({ n: 3, correct: 1, close: 1, wrong: 1, points: 15 });
    expect(scoreRate(t)).toBe(50);
  });

  it('같은 이름(대소문자·공백 무시)은 같은 선수', () => {
    let { store, id } = withPlayer(EMPTY_STORE, '  Kim  ');
    const again = upsertPlayer(store, 'kim', '2B');
    expect(again.player.id).toBe(id);
    expect(again.store.players).toHaveLength(1);
    expect(again.store.players[0].position).toBe('2B');
    store = upsertPlayer(again.store, '이', null).store;
    expect(store.players).toHaveLength(2);
    expect(() => upsertPlayer(store, '   ', null)).toThrow();
  });

  it('순위: 점수율 순, 최소 문제 수 미달은 순위 없음, 오답 다시 풀기 제외', () => {
    let a = withPlayer(EMPTY_STORE, 'A');
    let store = a.store;
    const b = withPlayer(store, 'B');
    store = b.store;
    const c = withPlayer(store, 'C');
    store = c.store;
    store = play(store, a.id, ['correct', 'correct', 'close', 'wrong', 'wrong']); // 50%
    store = play(store, b.id, ['correct', 'correct', 'correct', 'correct', 'close']); // 90%
    store = play(store, b.id, ['wrong', 'wrong'], { retry: true }); // 순위 제외
    store = play(store, c.id, ['correct']); // 문제 수 미달
    const rows = leaderboard(store);
    expect(rows.map((r) => r.player.name)).toEqual(['B', 'A', 'C']);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, null]);
    expect(rows[0].rate).toBe(90);
    expect(rows[0].total.n).toBe(5);
    expect(rows[2].total.n).toBeLessThan(RANK_MIN_QUESTIONS);
    void a;
  });

  it('동점은 같은 순위', () => {
    let a = withPlayer(EMPTY_STORE, 'A');
    const b = withPlayer(a.store, 'B');
    let store = play(b.store, a.id, Array(5).fill('correct'));
    store = play(store, b.id, Array(5).fill('correct'));
    expect(leaderboard(store).map((r) => r.rank)).toEqual([1, 1]);
    a = { ...a };
  });

  it('선수 통계: 포지션·타구별, 최고 기록, 추이, 약점', () => {
    let { store, id } = withPlayer(EMPTY_STORE, 'A');
    store = addSession(store, {
      playerId: id, date: 1, position: null, difficulty: 'normal', retry: false,
      answers: [ans('correct', 'SS', 'ground'), ans('correct', 'SS', 'ground'), ans('correct', 'SS', 'ground'),
        ans('wrong', 'LF', 'extra'), ans('wrong', 'LF', 'extra'), ans('close', 'LF', 'extra')],
    });
    store = play(store, id, ['correct', 'correct'], { date: 2 });
    const s = playerStats(store, id)!;
    expect(s.total.n).toBe(8);
    expect(s.byPosition.SS?.n).toBe(3);
    expect(scoreRate(s.byPosition.LF!)).toBe(17);
    expect(s.best).toBe(100);
    expect(s.trend).toEqual([58, 100]);
    expect(weakest(s.byPosition)?.key).toBe('LF');
    expect(weakest(s.byKind)?.key).toBe('extra');
  });

  it('빈 답안 판은 저장하지 않고, 선수 삭제 시 기록도 삭제', () => {
    let { store, id } = withPlayer(EMPTY_STORE, 'A');
    expect(play(store, id, []).sessions).toHaveLength(0);
    store = play(store, id, ['correct']);
    store = removePlayer(store, id);
    expect(store.players).toHaveLength(0);
    expect(store.sessions).toHaveLength(0);
    expect(store.currentId).toBeNull();
  });

  it('저장값 파싱: 왕복 보존, 손상된 항목은 버림', () => {
    let { store, id } = withPlayer(EMPTY_STORE, 'A');
    store = play(store, id, ['correct', 'wrong']);
    expect(parseStore(JSON.stringify(store))).toEqual(store);

    const broken = {
      players: [{ id: 'x', name: 'X', position: 'ZZ' }, { name: 'no id' }, null],
      sessions: [
        { id: 's1', playerId: 'x', difficulty: '??', answers: [{ fielder: 'P', grade: 'correct', situation: S }, { fielder: 'P', grade: 'meh' }] },
        { id: 's2', playerId: 'ghost', answers: [] },
      ],
      currentId: 'ghost',
    };
    const p = parseStore(JSON.stringify(broken))!;
    expect(p.players).toEqual([{ id: 'x', name: 'X', position: null, createdAt: 0 }]);
    expect(p.sessions).toHaveLength(1);
    expect(p.sessions[0].difficulty).toBe('normal');
    expect(p.sessions[0].answers).toHaveLength(1);
    expect(p.currentId).toBeNull();
  });

  it('선수 ID는 이름 기반 — 다른 기기에서 같은 이름이면 같은 ID', () => {
    const a = upsertPlayer(EMPTY_STORE, ' 홍길동 ', null).player;
    const b = upsertPlayer(EMPTY_STORE, '홍길동', '2B').player;
    expect(a.id).toBe(b.id);
    expect(playerKey('Kim')).toBe(playerKey('kim'));
    expect(playerKey('a/b')).not.toContain('/');
  });

  it('같은 ID의 판은 한 번만 저장 (클라우드 재전송 대비)', () => {
    let { store, id } = withPlayer(EMPTY_STORE, 'A');
    const rec = { id: 's1', playerId: id, date: 1, position: null, difficulty: 'normal' as const, retry: false, answers: [ans('correct')] };
    store = addSession(addSession(store, rec), rec);
    expect(store.sessions).toHaveLength(1);
  });

  it('예전 형식 ID 선수는 같은 이름의 새 선수로 합쳐진다', () => {
    const legacy = { id: 'p_%EC%98%A4', name: '오', position: null, createdAt: 1 };
    const fresh = { id: playerKey('오'), name: '오', position: null, createdAt: 2, ownerUid: 'u' };
    const ss = [{ id: 's1', playerId: legacy.id, date: 1, position: null, difficulty: 'normal' as const, retry: false, answers: [ans('correct')] }];
    expect(mergeLegacy([legacy], ss).players).toHaveLength(1); // 새 선수 없으면 그대로
    const m = mergeLegacy([legacy, fresh], ss);
    expect(m.players.map((p) => p.id)).toEqual([fresh.id]);
    expect(m.sessions[0].playerId).toBe(fresh.id);
  });
});
