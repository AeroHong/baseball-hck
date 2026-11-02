import { useState } from 'react';
import { DIFFICULTY_NAME, THRESHOLDS, type Difficulty } from '../quiz';
import { NAME_MAX, normalizeName, type Player } from '../records';
import type { PosKey } from '../types';
import { POS_KEYS, POS_NAME, POS_NUMBER } from '../types';

export interface QuizSettings {
  position: PosKey | null;
  count: number;
  difficulty: Difficulty;
}

export const COUNTS = [5, 10, 20] as const;
const DIFFS: Difficulty[] = ['easy', 'normal', 'hard'];
const DIFF_HINT: Record<Difficulty, string> = {
  easy: '역할 힌트 표시',
  normal: '힌트 없음',
  hard: '힌트 없음 · 기준 엄격',
};

interface QuizSetupProps {
  players: Player[];
  current: Player | null;
  settings: QuizSettings;
  onSettings: (s: QuizSettings) => void;
  onSelectPlayer: (id: string | null) => void;
  onRegister: (name: string) => void;
  onStart: () => void;
}

export default function QuizSetup(p: QuizSetupProps) {
  const [adding, setAdding] = useState(p.players.length === 0);
  const [name, setName] = useState('');
  const set = (patch: Partial<QuizSettings>) => p.onSettings({ ...p.settings, ...patch });
  const n = normalizeName(name);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!n) return;
    p.onRegister(n);
    setName('');
    setAdding(false);
  };

  return (
    <section className="quiz-setup" aria-labelledby="setup-h">
      <h2 id="setup-h">퀴즈 준비</h2>

      <div className="setup-block">
        <span className="control-label">선수</span>
        {p.players.length > 0 && (
          <div className="segment">
            {p.players.map((pl) => (
              <button key={pl.id} type="button" aria-pressed={p.current?.id === pl.id} onClick={() => p.onSelectPlayer(pl.id)}>
                {pl.name}
              </button>
            ))}
            {!adding && (
              <button type="button" className="ghost" onClick={() => setAdding(true)}>
                + 새 선수
              </button>
            )}
          </div>
        )}
        {adding && (
          <form className="name-form" onSubmit={submit}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={NAME_MAX + 4}
              placeholder="이름 또는 별명"
              aria-label="선수 이름"
              autoFocus
            />
            <button type="submit" disabled={!n}>
              등록
            </button>
            {p.players.length > 0 && (
              <button type="button" className="ghost" onClick={() => setAdding(false)}>
                취소
              </button>
            )}
          </form>
        )}
      </div>

      <div className="setup-block">
        <span className="control-label">내 포지션</span>
        <div className="segment pos-grid">
          <button type="button" aria-pressed={p.settings.position === null} onClick={() => set({ position: null })}>
            전체
          </button>
          {POS_KEYS.map((k) => (
            <button key={k} type="button" aria-pressed={p.settings.position === k} onClick={() => set({ position: k })}>
              <b>{POS_NUMBER[k]}</b> {POS_NAME[k]}
            </button>
          ))}
        </div>
        <p className="hint-inline">
          {p.settings.position
            ? `${POS_NAME[p.settings.position]}가 커버·중계·백업으로 움직이는 상황만 나옵니다.`
            : '아홉 포지션에서 골고루 나옵니다.'}
        </p>
      </div>

      <div className="setup-row">
        <div className="setup-block">
          <span className="control-label">문항 수</span>
          <div className="segment">
            {COUNTS.map((c) => (
              <button key={c} type="button" aria-pressed={p.settings.count === c} onClick={() => set({ count: c })}>
                {c}문제
              </button>
            ))}
          </div>
        </div>
        <div className="setup-block">
          <span className="control-label">난이도</span>
          <div className="segment">
            {DIFFS.map((d) => (
              <button key={d} type="button" aria-pressed={p.settings.difficulty === d} onClick={() => set({ difficulty: d })}>
                {DIFFICULTY_NAME[d]}
              </button>
            ))}
          </div>
          <p className="hint-inline">
            {DIFF_HINT[p.settings.difficulty]} · 정답 {THRESHOLDS[p.settings.difficulty].correct}ft · 근접{' '}
            {THRESHOLDS[p.settings.difficulty].close}ft 이내
          </p>
        </div>
      </div>

      <div className="quiz-actions">
        <button type="button" className="primary" disabled={!p.current} onClick={p.onStart}>
          {p.current ? `${p.current.name} 선수, 시작 →` : '선수를 먼저 등록하세요'}
        </button>
      </div>
      <p className="hint-inline">정답 10점 · 근접 5점 · 오답 0점. 기록은 클라우드에 저장되어 ‘기록’ 탭 순위표에 올라갑니다 (이름이 같으면 같은 선수).</p>
    </section>
  );
}
