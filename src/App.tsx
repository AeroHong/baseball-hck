import { useMemo, useState } from 'react';
import Field from './components/Field';
import Play from './components/Play';
import { startPositions } from './geometry';
import { computePlan } from './rules';
import type { Role, Situation } from './types';
import { BASE_NAME, POS_KEYS, POS_NAME, POS_NUMBER, ROLE_NAME } from './types';

const LEGEND: Role[] = ['ball', 'cover', 'cut', 'back', 'stand'];

const R = (...b: (1 | 2 | 3)[]) => ({ 1: b.includes(1), 2: b.includes(2), 3: b.includes(3) });
/** 임시 예시 상황 — 5단계 조작판이 들어오면 제거 */
const PRESETS: { label: string; s: Situation }[] = [
  { label: '좌익 단타 · 주자 2루 · 1아웃', s: { kind: 'single', angle: -27, runners: R(2), outs: 1, shift: 'normal' } },
  { label: '좌익 단타 · 주자 2루 · 2아웃 (대체 경로)', s: { kind: 'single', angle: -27, runners: R(2), outs: 2, shift: 'normal' } },
  { label: '우익 단타 · 주자 1루 → 3루 승부', s: { kind: 'single', angle: 27, runners: R(1), outs: 0, shift: 'normal' } },
  { label: '유격수 땅볼 · 주자 1루 · 병살', s: { kind: 'ground', angle: -14, runners: R(1), outs: 0, shift: 'dp' } },
  { label: '1루수 땅볼 · 주자 없음 (투수 1루 커버)', s: { kind: 'ground', angle: 40, runners: R(), outs: 0, shift: 'normal' } },
  { label: '좌선상 장타 · 주자 1루 → 홈 (탠덤 릴레이)', s: { kind: 'extra', angle: -40, runners: R(1), outs: 0, shift: 'normal' } },
  { label: '우익 장타 · 주자 없음 → 3루', s: { kind: 'extra', angle: 27, runners: R(), outs: 1, shift: 'normal' } },
  { label: '중견 뜬공 · 주자 3루 · 1아웃 (태그업)', s: { kind: 'fly', angle: 0, runners: R(3), outs: 1, shift: 'normal' } },
  { label: '중견 뜬공 · 주자 3루 · 2아웃 (송구 없음)', s: { kind: 'fly', angle: 0, runners: R(3), outs: 2, shift: 'normal' } },
];

export default function App() {
  // 5단계에서 조작판이 이 상태를 바꾼다
  const [presetIndex, setPresetIndex] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const situation = PRESETS[presetIndex].s;
  const plan = useMemo(() => computePlan(situation), [situation]);
  const start = useMemo(() => startPositions(situation.shift), [situation.shift]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>야구 백업 플레이 시뮬레이터</h1>
        <div className="toolbar">
          <p className="scoreboard">{plan.title}</p>
          <select
            aria-label="예시 상황"
            value={presetIndex}
            onChange={(e) => setPresetIndex(Number(e.target.value))}
          >
            {PRESETS.map((p, i) => (
              <option key={p.label} value={i}>
                {p.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setReplayKey((k) => k + 1)}>
            ↻ 다시 재생
          </button>
        </div>
      </header>

      <div className="layout">
        <section className="field-wrap" aria-label="그라운드">
          <Field>
            <Play plan={plan} start={start} replayKey={replayKey} />
          </Field>
          <ul className="legend">
            {LEGEND.map((r) => (
              <li key={r} className={`role-${r}`}>
                <span className="dot" />
                {ROLE_NAME[r]}
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2>상황 요약</h2>
          <ul className="notes">
            {plan.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          {plan.warnings && (
            <ul className="warnings">
              {plan.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}

          <h2>포지션별 역할</h2>
          <ol className="roles">
            {POS_KEYS.map((k) => {
              const a = plan.assignments[k];
              return (
                <li key={k} className={`role-${a.role}`}>
                  <span className="num">{POS_NUMBER[k]}</span>
                  <span>
                    <b>{POS_NAME[k]}</b> · {ROLE_NAME[a.role]}
                    {a.base ? ` (${BASE_NAME[a.base]})` : ''}
                    <br />
                    <small>{a.text}</small>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </div>
  );
}
