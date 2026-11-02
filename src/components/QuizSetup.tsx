import { useState } from 'react';
import { DIFFICULTY_NAME, THRESHOLDS, type Difficulty } from '../quiz';
import { NAME_MAX, normalizeName, playerKey, type Player } from '../records';
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
  /** 클라우드: 이름 + PIN 로그인. false 면(클라우드 장애) 이름만 */
  pinMode: boolean;
  settings: QuizSettings;
  onSettings: (s: QuizSettings) => void;
  /** 로컬 모드에서 선수 고르기 */
  onSelectPlayer: (id: string | null) => void;
  /** 이름 + PIN. 있는 이름이면 로그인, 없으면 등록. 실패하면 화면 문구 */
  onSignIn: (name: string, pin: string) => Promise<string | null>;
  onSignOut: () => void;
  onStart: () => void;
}

const PIN = /^\d{4}$/;

function PlayerLogin(p: QuizSetupProps) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const n = normalizeName(name);
  const existing = n ? p.players.find((x) => x.id === playerKey(n)) : undefined;
  const isNew = !!n && !existing;
  const ready = !!n && (!p.pinMode || (PIN.test(pin) && (!isNew || pin2 === pin)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const err = await p.onSignIn(n, pin);
    setBusy(false);
    if (err) setError(err);
    else {
      setName('');
      setPin('');
      setPin2('');
    }
  };
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 4);

  return (
    <form className="login-form" onSubmit={submit}>
      {p.players.length > 0 && (
        <div className="segment player-chips" aria-label="등록된 선수">
          {p.players.map((pl) => (
            <button
              key={pl.id}
              type="button"
              aria-pressed={existing?.id === pl.id}
              onClick={() => {
                if (!p.pinMode) return p.onSelectPlayer(pl.id);
                setName(pl.name);
                setPin('');
                setError(null);
              }}
            >
              {pl.name}
            </button>
          ))}
        </div>
      )}
      <div className="name-form">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          maxLength={NAME_MAX + 4}
          placeholder="이름 또는 별명"
          aria-label="선수 이름"
          autoComplete="off"
        />
        {p.pinMode && (
          <input
            className="pin"
            value={pin}
            onChange={(e) => setPin(digits(e.target.value))}
            type="password"
            inputMode="numeric"
            autoComplete={isNew ? 'new-password' : 'current-password'}
            placeholder="PIN 4자리"
            aria-label="PIN 4자리"
          />
        )}
        {p.pinMode && isNew && (
          <input
            className="pin"
            value={pin2}
            onChange={(e) => setPin2(digits(e.target.value))}
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            placeholder="PIN 확인"
            aria-label="PIN 다시 입력"
          />
        )}
        <button type="submit" disabled={!ready || busy}>
          {busy ? '확인 중…' : !p.pinMode ? '등록' : isNew ? '새로 등록' : '로그인'}
        </button>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : (
        p.pinMode &&
        n && (
          <p className="hint-inline">
            {isNew
              ? '새 선수로 등록합니다. PIN 4자리를 정하세요 — 다른 기기에서 이어 풀 때 필요하고, 잊으면 되찾을 수 없습니다.'
              : pin2 && PIN.test(pin) && pin2 !== pin
                ? ''
                : '등록된 이름입니다. 그 선수의 PIN을 입력하세요.'}
          </p>
        )
      )}
      {p.pinMode && isNew && PIN.test(pin) && pin2.length === 4 && pin2 !== pin && (
        <p className="form-error" role="alert">
          PIN이 서로 다릅니다.
        </p>
      )}
    </form>
  );
}

export default function QuizSetup(p: QuizSetupProps) {
  const set = (patch: Partial<QuizSettings>) => p.onSettings({ ...p.settings, ...patch });

  return (
    <section className="quiz-setup" aria-labelledby="setup-h">
      <h2 id="setup-h">퀴즈 준비</h2>

      <div className="setup-block">
        <span className="control-label">선수</span>
        {p.current ? (
          <div className="logged-in">
            <span>
              <b>{p.current.name}</b> 선수{p.pinMode ? '로 로그인됨' : ''}
            </span>
            <button type="button" className="ghost small" onClick={p.onSignOut}>
              다른 선수로 바꾸기
            </button>
          </div>
        ) : (
          <PlayerLogin {...p} />
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
          {p.current ? `${p.current.name} 선수, 시작 →` : p.pinMode ? '이름과 PIN으로 로그인하세요' : '선수를 먼저 등록하세요'}
        </button>
      </div>
      <p className="hint-inline">정답 10점 · 근접 5점 · 오답 0점. 기록은 클라우드에 저장되어 ‘기록’ 탭 순위표에 올라갑니다 (이름이 같으면 같은 선수).</p>
    </section>
  );
}
