import { useEffect, useMemo, useState } from 'react';
import Controls from './components/Controls';
import Field from './components/Field';
import Play from './components/Play';
import Runners from './components/Runners';
import { startPositions } from './geometry';
import { computePlan } from './rules';
import { applyClick, fromQuery, interpretClick, toQuery } from './situation';
import type { Role, Situation } from './types';
import { BASE_NAME, POS_KEYS, POS_NAME, POS_NUMBER, ROLE_NAME } from './types';

const LEGEND: Role[] = ['ball', 'cover', 'cut', 'back', 'stand'];

/** 화면 좌표 → 필드 좌표(ft) */
function toFieldPoint(e: React.PointerEvent<SVGSVGElement>) {
  const svg = e.currentTarget;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: -p.y };
}

export default function App() {
  const [situation, setSituation] = useState<Situation>(() => fromQuery(window.location.search));
  const [replayKey, setReplayKey] = useState(0);
  const plan = useMemo(() => computePlan(situation), [situation]);
  const start = useMemo(() => startPositions(situation.shift), [situation.shift]);

  // 상황을 URL 에 반영 → 링크로 공유 가능
  useEffect(() => {
    const url = `${window.location.pathname}?${toQuery(situation)}`;
    window.history.replaceState(null, '', url);
  }, [situation]);

  const onFieldPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = toFieldPoint(e);
    if (!p) return;
    const click = interpretClick(p);
    if (click) setSituation((s) => applyClick(s, click));
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>야구 백업 플레이 시뮬레이터</h1>
        <div className="toolbar">
          <p className="scoreboard" aria-live="polite">
            {plan.title}
          </p>
          <button type="button" onClick={() => setReplayKey((k) => k + 1)}>
            ↻ 다시 재생
          </button>
        </div>
      </header>

      <div className="layout">
        <section className="field-wrap" aria-label="그라운드">
          <Field onPointerDown={onFieldPointerDown}>
            <Play plan={plan} start={start} replayKey={replayKey} />
            <Runners runners={situation.runners} />
          </Field>
          <ul className="legend">
            {LEGEND.map((r) => (
              <li key={r} className={`role-${r}`}>
                <span className="dot" />
                {ROLE_NAME[r]}
              </li>
            ))}
          </ul>
          <p className="hint">그라운드를 누르면 타구 방향, 베이스를 누르면 주자 추가·제거. 내야(홈에서 135ft 이내)를 누르면 땅볼로 바뀝니다.</p>
        </section>

        <section className="panel">
          <Controls situation={situation} onChange={setSituation} />

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
