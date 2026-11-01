import { useMemo, useState } from 'react';
import Field from './components/Field';
import Fielders from './components/Fielders';
import { startPositions } from './geometry';
import { computePlan } from './rules';
import type { PosKey, Role, Situation } from './types';
import { BASE_NAME, POS_KEYS, POS_NAME, POS_NUMBER, ROLE_NAME } from './types';

const LEGEND: Role[] = ['ball', 'cover', 'cut', 'back', 'stand'];

export default function App() {
  // 5단계에서 조작판이 이 상태를 바꾼다
  const [situation] = useState<Situation>({
    kind: 'single',
    angle: -27,
    runners: { 1: false, 2: true, 3: false },
    outs: 1,
    shift: 'normal',
  });
  const plan = useMemo(() => computePlan(situation), [situation]);
  const start = useMemo(() => startPositions(situation.shift), [situation.shift]);
  const roles = useMemo(
    () => Object.fromEntries(POS_KEYS.map((k) => [k, plan.assignments[k].role])) as Record<PosKey, Role>,
    [plan],
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1>야구 백업 플레이 시뮬레이터</h1>
        <p className="scoreboard">{plan.title}</p>
      </header>

      <div className="layout">
        <section className="field-wrap" aria-label="그라운드">
          <Field>
            <Fielders positions={start} roles={roles} />
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
