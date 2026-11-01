import { useEffect, useMemo, useRef, useState } from 'react';
import Controls from './components/Controls';
import Field from './components/Field';
import Play from './components/Play';
import QuizLayer from './components/QuizLayer';
import QuizPanel, { type QuizScore } from './components/QuizPanel';
import RoleCards from './components/RoleCards';
import Runners from './components/Runners';
import Scoreboard, { type Mode, type Theme } from './components/Scoreboard';
import Summary from './components/Summary';
import TeamOptions from './components/TeamOptions';
import { startPositions } from './geometry';
import { grade, makeQuestion, type Question } from './quiz';
import { computePlan } from './rules';
import { applyClick, fromQuery, interpretClick, toQuery } from './situation';
import type { Options, Point, PosKey, Role, Situation } from './types';
import { DEFAULT_OPTIONS, POS_NUMBER, ROLE_NAME } from './types';

const LEGEND: Role[] = ['ball', 'cover', 'cut', 'back', 'stand'];
const THEME_KEY = 'baseball-hck:theme';
const OPTIONS_KEY = 'baseball-hck:options';
const QUIZ_KEY = 'baseball-hck:quiz';
const ZERO: QuizScore = { correct: 0, close: 0, wrong: 0 };

function load<T>(key: string, fallback: T, parse: (raw: string) => T | null): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (parse(raw) ?? fallback) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 저장 불가 환경은 무시 */
  }
}

const parseTheme = (raw: string): Theme | null => (raw === 'light' || raw === 'dark' || raw === 'auto' ? raw : null);
function parseOptions(raw: string): Options | null {
  const o = JSON.parse(raw) as Partial<Options>;
  const out = { ...DEFAULT_OPTIONS };
  for (const k of Object.keys(DEFAULT_OPTIONS) as (keyof Options)[]) {
    if (typeof o[k] === 'string') (out as Record<string, string>)[k] = o[k] as string;
  }
  return out;
}
function parseScore(raw: string): QuizScore | null {
  const o = JSON.parse(raw) as Partial<QuizScore>;
  return { correct: Number(o.correct) || 0, close: Number(o.close) || 0, wrong: Number(o.wrong) || 0 };
}

/** 화면 좌표 → 필드 좌표(ft) */
function toFieldPoint(e: React.PointerEvent<SVGSVGElement>): Point | null {
  const svg = e.currentTarget;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: -p.y };
}

interface QuizState extends Question {
  guess: Point | null;
  revealed: boolean;
}

export default function App() {
  const [mode, setMode] = useState<Mode>('learn');
  const [situation, setSituation] = useState<Situation>(() => fromQuery(window.location.search));
  const [replayKey, setReplayKey] = useState(0);
  const [focus, setFocus] = useState<PosKey | null>(null);
  const [theme, setTheme] = useState<Theme>(() => load(THEME_KEY, 'auto', parseTheme));
  const [options, setOptions] = useState<Options>(() => load(OPTIONS_KEY, DEFAULT_OPTIONS, parseOptions));
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [session, setSession] = useState<QuizScore>(ZERO);
  const [total, setTotal] = useState<QuizScore>(() => load(QUIZ_KEY, ZERO, parseScore));
  const dragging = useRef(false);

  const inQuiz = mode === 'quiz' && quiz !== null;
  const active = inQuiz ? quiz.situation : situation;
  const plan = useMemo(() => computePlan(active, options), [active, options]);
  const start = useMemo(() => startPositions(active.shift), [active.shift]);

  // 학습 모드 상황만 URL 에 반영 → 링크로 공유 가능
  useEffect(() => {
    window.history.replaceState(null, '', `${window.location.pathname}?${toQuery(situation)}`);
  }, [situation]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') delete root.dataset.theme;
    else root.dataset.theme = theme;
    save(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => save(OPTIONS_KEY, JSON.stringify(options)), [options]);
  useEffect(() => save(QUIZ_KEY, JSON.stringify(total)), [total]);

  const newQuestion = () => {
    setQuiz({ ...makeQuestion(options), guess: null, revealed: false });
    setFocus(null);
  };

  const changeMode = (m: Mode) => {
    setMode(m);
    setFocus(null);
    if (m === 'quiz' && !quiz) newQuestion();
  };

  const result = inQuiz && quiz.guess ? grade(quiz.guess, plan.assignments[quiz.fielder].pos) : null;

  const reveal = () => {
    if (!inQuiz || !result || quiz.revealed) return;
    setQuiz({ ...quiz, revealed: true });
    const add = (s: QuizScore) => ({ ...s, [result.grade]: s[result.grade] + 1 });
    setSession(add);
    setTotal(add);
  };

  const onFieldPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = toFieldPoint(e);
    if (!p) return;
    if (inQuiz) {
      if (quiz.revealed) return;
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setQuiz({ ...quiz, guess: p });
      return;
    }
    const click = interpretClick(p);
    if (click) setSituation((s) => applyClick(s, click));
  };
  const onFieldPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!inQuiz || !dragging.current || quiz.revealed) return;
    const p = toFieldPoint(e);
    if (p) setQuiz({ ...quiz, guess: p });
  };
  const onFieldPointerUp = () => {
    dragging.current = false;
  };

  return (
    <div className={`app mode-${mode}`}>
      <header className="app-header">
        <h1>야구 백업 플레이 시뮬레이터</h1>
        <Scoreboard
          plan={plan}
          onReplay={() => setReplayKey((k) => k + 1)}
          theme={theme}
          onTheme={setTheme}
          mode={mode}
          onMode={changeMode}
        />
      </header>

      <div className="layout">
        <section className="field-wrap" aria-label="그라운드">
          <Field onPointerDown={onFieldPointerDown} onPointerMove={onFieldPointerMove} onPointerUp={onFieldPointerUp}>
            <Play
              key={inQuiz ? `quiz-${quiz.fielder}-${JSON.stringify(quiz.situation)}` : 'learn'}
              plan={plan}
              start={start}
              replayKey={replayKey}
              focus={focus}
              onFocus={setFocus}
              exclude={inQuiz ? quiz.fielder : null}
            />
            {inQuiz ? (
              <QuizLayer
                number={POS_NUMBER[quiz.fielder]}
                start={start[quiz.fielder]}
                guess={quiz.guess}
                answer={quiz.revealed ? plan.assignments[quiz.fielder].pos : null}
                answerRole={plan.assignments[quiz.fielder].role}
                grade={quiz.revealed && result ? result.grade : null}
                error={quiz.revealed && result ? result.error : null}
              />
            ) : (
              <Runners runners={situation.runners} />
            )}
          </Field>
          <ul className="legend">
            {LEGEND.map((r) => (
              <li key={r} className={`role-${r}`}>
                <span className="dot" />
                {ROLE_NAME[r]}
              </li>
            ))}
          </ul>
          <p className="hint">
            {inQuiz
              ? '그라운드를 눌러 위치를 찍고 끌어서 조정하세요.'
              : '그라운드를 누르면 타구 방향, 베이스를 누르면 주자 추가·제거. 내야(홈에서 135ft 이내)는 땅볼.'}
          </p>
        </section>

        <div className="panel">
          {inQuiz ? (
            <>
              <QuizPanel
                fielder={quiz.fielder}
                hasGuess={quiz.guess !== null}
                revealed={quiz.revealed}
                grade={result?.grade ?? null}
                error={result?.error ?? null}
                answer={plan.assignments[quiz.fielder]}
                session={session}
                total={total}
                onReveal={reveal}
                onNext={newQuestion}
              />
              {quiz.revealed && (
                <>
                  <Summary plan={plan} />
                  <RoleCards plan={plan} focus={focus} onFocus={setFocus} />
                </>
              )}
            </>
          ) : (
            <>
              <Controls situation={situation} onChange={setSituation} />
              <Summary plan={plan} />
              <RoleCards plan={plan} focus={focus} onFocus={setFocus} />
              <TeamOptions options={options} onChange={setOptions} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
