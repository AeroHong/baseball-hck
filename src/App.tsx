import { useEffect, useMemo, useState } from 'react';
import Controls from './components/Controls';
import Field from './components/Field';
import Play from './components/Play';
import RoleCards from './components/RoleCards';
import Runners from './components/Runners';
import Scoreboard, { type Theme } from './components/Scoreboard';
import Summary from './components/Summary';
import TeamOptions from './components/TeamOptions';
import { startPositions } from './geometry';
import { computePlan } from './rules';
import { applyClick, fromQuery, interpretClick, toQuery } from './situation';
import type { Options, PosKey, Role, Situation } from './types';
import { DEFAULT_OPTIONS, ROLE_NAME } from './types';

const LEGEND: Role[] = ['ball', 'cover', 'cut', 'back', 'stand'];
const THEME_KEY = 'baseball-hck:theme';
const OPTIONS_KEY = 'baseball-hck:options';

function loadOptions(): Options {
  try {
    const raw = localStorage.getItem(OPTIONS_KEY);
    if (!raw) return DEFAULT_OPTIONS;
    const o = JSON.parse(raw) as Partial<Options>;
    // 저장된 값 중 유효한 키만 반영
    const out = { ...DEFAULT_OPTIONS };
    for (const k of Object.keys(DEFAULT_OPTIONS) as (keyof Options)[]) {
      if (typeof o[k] === 'string') (out as Record<string, string>)[k] = o[k] as string;
    }
    return out;
  } catch {
    return DEFAULT_OPTIONS;
  }
}

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

function loadTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : 'auto';
  } catch {
    return 'auto';
  }
}

export default function App() {
  const [situation, setSituation] = useState<Situation>(() => fromQuery(window.location.search));
  const [replayKey, setReplayKey] = useState(0);
  const [focus, setFocus] = useState<PosKey | null>(null);
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [options, setOptions] = useState<Options>(loadOptions);
  const plan = useMemo(() => computePlan(situation, options), [situation, options]);
  const start = useMemo(() => startPositions(situation.shift), [situation.shift]);

  // 상황을 URL 에 반영 → 링크로 공유 가능
  useEffect(() => {
    window.history.replaceState(null, '', `${window.location.pathname}?${toQuery(situation)}`);
  }, [situation]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* 저장 불가 환경은 무시 */
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(OPTIONS_KEY, JSON.stringify(options));
    } catch {
      /* 저장 불가 환경은 무시 */
    }
  }, [options]);

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
        <Scoreboard plan={plan} onReplay={() => setReplayKey((k) => k + 1)} theme={theme} onTheme={setTheme} />
      </header>

      <div className="layout">
        <section className="field-wrap" aria-label="그라운드">
          <Field onPointerDown={onFieldPointerDown}>
            <Play plan={plan} start={start} replayKey={replayKey} focus={focus} onFocus={setFocus} />
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
          <p className="hint">그라운드를 누르면 타구 방향, 베이스를 누르면 주자 추가·제거. 내야(홈에서 135ft 이내)는 땅볼.</p>
        </section>

        <div className="panel">
          <Controls situation={situation} onChange={setSituation} />
          <Summary plan={plan} />
          <RoleCards plan={plan} focus={focus} onFocus={setFocus} />
          <TeamOptions options={options} onChange={setOptions} />
        </div>
      </div>
    </div>
  );
}
