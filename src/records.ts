/**
 * 선수 등록 · 퀴즈 기록 · 대시보드 통계 (순수 함수).
 * 저장: 클라우드(cloud.ts, Firestore) 가 기본, 연결할 수 없으면 localStorage.
 */
import type { Difficulty, Grade } from './quiz';
import { MAX_POINTS, POINTS } from './quiz';
import type { Kind, PosKey, Situation } from './types';
import { POS_KEYS } from './types';

export interface Player {
  id: string;
  name: string;
  /** 주 포지션. null = 전체 포지션 */
  position: PosKey | null;
  createdAt: number;
}

export interface AnswerRecord {
  situation: Situation;
  fielder: PosKey;
  grade: Grade;
  error: number;
}

export interface SessionRecord {
  id: string;
  playerId: string;
  date: number;
  /** 출제 포지션. null = 전체 */
  position: PosKey | null;
  difficulty: Difficulty;
  /** 오답 다시 풀기 판: 순위에서 제외 */
  retry: boolean;
  answers: AnswerRecord[];
}

export interface RecordStore {
  version: 1;
  players: Player[];
  sessions: SessionRecord[];
  currentId: string | null;
}

export const EMPTY_STORE: RecordStore = { version: 1, players: [], sessions: [], currentId: null };
export const NAME_MAX = 12;
/** 순위 집계 최소 문제 수 */
export const RANK_MIN_QUESTIONS = 5;
const MAX_SESSIONS = 300;

const DIFFS: Difficulty[] = ['easy', 'normal', 'hard'];
const GRADES: Grade[] = ['correct', 'close', 'wrong'];

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** 이름 기반 선수 ID: 다른 기기에서 같은 이름으로 등록해도 같은 선수가 된다 */
export function playerKey(name: string): string {
  return 'p_' + encodeURIComponent(normalizeName(name).toLowerCase());
}

export function normalizeName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
}

/** 손상된 저장값에도 버티도록 필드를 하나씩 검증 */
export function parseStore(raw: string): RecordStore | null {
  const o = JSON.parse(raw) as Partial<RecordStore>;
  if (!o || typeof o !== 'object') return null;
  const isPos = (p: unknown): p is PosKey => POS_KEYS.includes(p as PosKey);
  const players: Player[] = Array.isArray(o.players)
    ? o.players
        .filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string' && normalizeName(p.name))
        .map((p) => ({ id: p.id, name: normalizeName(p.name), position: isPos(p.position) ? p.position : null, createdAt: Number(p.createdAt) || 0 }))
    : [];
  const ids = new Set(players.map((p) => p.id));
  const sessions: SessionRecord[] = Array.isArray(o.sessions)
    ? o.sessions
        .filter((s) => s && typeof s.id === 'string' && ids.has(s.playerId) && Array.isArray(s.answers))
        .map((s) => ({
          id: s.id,
          playerId: s.playerId,
          date: Number(s.date) || 0,
          position: isPos(s.position) ? s.position : null,
          difficulty: DIFFS.includes(s.difficulty) ? s.difficulty : 'normal',
          retry: !!s.retry,
          answers: s.answers.filter((a) => a && isPos(a.fielder) && GRADES.includes(a.grade) && a.situation),
        }))
    : [];
  const currentId = typeof o.currentId === 'string' && ids.has(o.currentId) ? o.currentId : null;
  return { version: 1, players, sessions, currentId };
}

/** 이름이 같으면(대소문자·공백 무시) 기존 선수를 고르고, 없으면 새로 등록 */
export function upsertPlayer(store: RecordStore, name: string, position: PosKey | null): { store: RecordStore; player: Player } {
  const n = normalizeName(name);
  if (!n) throw new Error('이름이 비어 있다');
  const found = store.players.find((p) => p.name.toLowerCase() === n.toLowerCase());
  if (found) {
    const player = { ...found, position };
    return { store: { ...store, players: store.players.map((p) => (p.id === found.id ? player : p)), currentId: found.id }, player };
  }
  const player: Player = { id: playerKey(n), name: n, position, createdAt: Date.now() };
  return { store: { ...store, players: [...store.players, player], currentId: player.id }, player };
}

export function setPlayerPosition(store: RecordStore, id: string, position: PosKey | null): RecordStore {
  return { ...store, players: store.players.map((p) => (p.id === id ? { ...p, position } : p)) };
}

export function removePlayer(store: RecordStore, id: string): RecordStore {
  return {
    ...store,
    players: store.players.filter((p) => p.id !== id),
    sessions: store.sessions.filter((s) => s.playerId !== id),
    currentId: store.currentId === id ? null : store.currentId,
  };
}

export function addSession(store: RecordStore, rec: Omit<SessionRecord, 'id'> & { id?: string }): RecordStore {
  if (!rec.answers.length) return store;
  if (rec.id && store.sessions.some((s) => s.id === rec.id)) return store;
  const sessions = [...store.sessions, { ...rec, id: rec.id ?? newId() }];
  return { ...store, sessions: sessions.slice(-MAX_SESSIONS) };
}

/* ── 통계 ─────────────────────────────────────────────── */

export interface Tally {
  n: number;
  correct: number;
  close: number;
  wrong: number;
  points: number;
}
export const ZERO_TALLY: Tally = { n: 0, correct: 0, close: 0, wrong: 0, points: 0 };

export function tally(answers: readonly { grade: Grade }[]): Tally {
  const t = { ...ZERO_TALLY };
  for (const a of answers) {
    t.n++;
    t[a.grade]++;
    t.points += POINTS[a.grade];
  }
  return t;
}

/** 점수율 0~100 (정답 10점 · 근접 5점 기준) */
export const scoreRate = (t: Tally) => (t.n ? Math.round((t.points / (t.n * MAX_POINTS)) * 100) : 0);
export const correctRate = (t: Tally) => (t.n ? Math.round((t.correct / t.n) * 100) : 0);

export interface PlayerStats {
  player: Player;
  sessions: SessionRecord[];
  total: Tally;
  byPosition: Partial<Record<PosKey, Tally>>;
  byKind: Partial<Record<Kind, Tally>>;
  /** 판별 최고 점수율 (오답 다시 풀기 제외) */
  best: number;
  /** 최근 판 점수율 (오래된 → 최근) */
  trend: number[];
}

function groupBy<K extends string>(answers: AnswerRecord[], key: (a: AnswerRecord) => K): Partial<Record<K, Tally>> {
  const groups: Partial<Record<K, AnswerRecord[]>> = {};
  for (const a of answers) (groups[key(a)] ??= []).push(a);
  const out: Partial<Record<K, Tally>> = {};
  for (const k of Object.keys(groups) as K[]) out[k] = tally(groups[k]!);
  return out;
}

export function playerStats(store: RecordStore, id: string): PlayerStats | null {
  const player = store.players.find((p) => p.id === id);
  if (!player) return null;
  const sessions = store.sessions.filter((s) => s.playerId === id).sort((a, b) => a.date - b.date);
  const answers = sessions.flatMap((s) => s.answers);
  const ranked = sessions.filter((s) => !s.retry);
  return {
    player,
    sessions,
    total: tally(answers),
    byPosition: groupBy(answers, (a) => a.fielder),
    byKind: groupBy(answers, (a) => a.situation.kind),
    best: ranked.reduce((m, s) => Math.max(m, scoreRate(tally(s.answers))), 0),
    trend: ranked.slice(-12).map((s) => scoreRate(tally(s.answers))),
  };
}

export interface LeaderRow {
  player: Player;
  rank: number | null;
  total: Tally;
  rate: number;
  best: number;
  plays: number;
  last: number;
}

/**
 * 순위: 오답 다시 풀기를 뺀 전체 점수율 → 문제 수 → 최근 플레이 순.
 * 문제 수가 RANK_MIN_QUESTIONS 미만이면 순위 없음(맨 아래).
 */
export function leaderboard(store: RecordStore): LeaderRow[] {
  const rows = store.players.map((player) => {
    const ss = store.sessions.filter((s) => s.playerId === player.id && !s.retry);
    const total = tally(ss.flatMap((s) => s.answers));
    return {
      player,
      rank: null as number | null,
      total,
      rate: scoreRate(total),
      best: ss.reduce((m, s) => Math.max(m, scoreRate(tally(s.answers))), 0),
      plays: ss.length,
      last: ss.reduce((m, s) => Math.max(m, s.date), 0),
    };
  });
  const qualified = (r: LeaderRow) => r.total.n >= RANK_MIN_QUESTIONS;
  rows.sort(
    (a, b) =>
      Number(qualified(b)) - Number(qualified(a)) || b.rate - a.rate || b.total.n - a.total.n || b.last - a.last,
  );
  let rank = 0;
  let prev: LeaderRow | null = null;
  rows.forEach((r, i) => {
    if (!qualified(r)) return;
    if (!prev || prev.rate !== r.rate) rank = i + 1;
    r.rank = rank;
    prev = r;
  });
  return rows;
}

/** 가장 약한 영역 (문제 3개 이상인 것 중 점수율 최저) */
export function weakest<K extends string>(groups: Partial<Record<K, Tally>>): { key: K; tally: Tally } | null {
  let best: { key: K; tally: Tally } | null = null;
  for (const k of Object.keys(groups) as K[]) {
    const t = groups[k]!;
    if (t.n < 3) continue;
    if (!best || scoreRate(t) < scoreRate(best.tally)) best = { key: k, tally: t };
  }
  return best;
}
