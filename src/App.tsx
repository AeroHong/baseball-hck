import { useMemo, useState } from 'react';
import { computePlan } from './rules';
import type { Situation } from './types';
import { BASE_NAME, POS_KEYS, POS_NAME, POS_NUMBER, ROLE_NAME } from './types';

// 임시 화면: 3단계(그라운드 SVG)부터 교체 예정
export default function App() {
  const [situation] = useState<Situation>({
    kind: 'single',
    angle: -27,
    runners: { 1: false, 2: true, 3: false },
    outs: 1,
    shift: 'normal',
  });
  const plan = useMemo(() => computePlan(situation), [situation]);

  return (
    <main className="app">
      <h1>야구 백업 플레이 시뮬레이터</h1>
      <p className="scoreboard">{plan.title}</p>
      <ul>
        {plan.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      <ol className="roles">
        {POS_KEYS.map((k) => {
          const a = plan.assignments[k];
          return (
            <li key={k} data-role={a.role}>
              <b>
                {POS_NUMBER[k]} {POS_NAME[k]}
              </b>{' '}
              · {ROLE_NAME[a.role]}
              {a.base ? ` (${BASE_NAME[a.base]})` : ''} — {a.text}
            </li>
          );
        })}
      </ol>
    </main>
  );
}
