import { useEffect, useMemo, useRef, useState } from 'react';
import Controls from './components/Controls';
import Dashboard from './components/Dashboard';
import Field from './components/Field';
import PlaybackBar from './components/PlaybackBar';
import Play from './components/Play';
import QuizLayer from './components/QuizLayer';
import QuizPanel from './components/QuizPanel';
import QuizResult from './components/QuizResult';
import QuizSetup, { COUNTS, type QuizSettings } from './components/QuizSetup';
import RoleCards from './components/RoleCards';
import Runners from './components/Runners';
import Scoreboard, { type Mode, type Theme } from './components/Scoreboard';
import Summary from './components/Summary';
import TeamOptions from './components/TeamOptions';
import { startPositions } from './geometry';
import { grade, makeRun, type Question } from './quiz';
import {
  EMPTY_STORE,
  addSession,
  leaderboard,
  parseStore,
  playerStats,
  removePlayer,
  setPlayerPosition,
  tally,
  upsertPlayer,
  type AnswerRecord,
  type RecordStore,
} from './records';
import { computePlan } from './rules';
import { applyClick, fromQuery, interpretClick, toQuery } from './situation';
import { Timeline } from './timeline';
import type { Options, Point, PosKey, Role, Situation } from './types';
import { DEFAULT_OPTIONS, POS_KEYS, POS_NUMBER, ROLE_NAME } from './types';

const LEGEND: Role[] = ['ball', 'cover', 'cut', 'back', 'stand'];
const THEME_KEY = 'baseball-hck:theme';
const OPTIONS_KEY = 'baseball-hck:options';
const RECORDS_KEY = 'baseball-hck:records';
const SETTINGS_KEY = 'baseball-hck:quiz-settings';
const DEFAULT_SETTINGS: QuizSettings = { position: null, count: 10, difficulty: 'normal' };

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
function parseSettings(raw: string): QuizSettings | null {
  const o = JSON.parse(raw) as Partial<QuizSettings>;
  return {
    position: POS_KEYS.includes(o.position as PosKey) ? (o.position as PosKey) : null,
    count: COUNTS.includes(o.count as (typeof COUNTS)[number]) ? (o.count as number) : DEFAULT_SETTINGS.count,
    difficulty: o.difficulty === 'easy' || o.difficulty === 'hard' ? o.difficulty : 'normal',
  };
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

/** 한 판의 진행 상태 */
interface QuizRun {
  playerId: string;
  settings: QuizSettings;
  retry: boolean;
  questions: Question[];
  index: number;
  guess: Point | null;
  revealed: boolean;
  answers: AnswerRecord[];
  done: boolean;
  /** 이 판 시작 전 개인 최고 점수율 */
  prevBest: number;
}

export default function App() {
  const [mode, setMode] = useState<Mode>('learn');
  const [situation, setSituation] = useState<Situation>(() => fromQuery(window.location.search));
  const [replayKey, setReplayKey] = useState(0);
  const [focus, setFocus] = useState<PosKey | null>(null);
  const [theme, setTheme] = useState<Theme>(() => load(THEME_KEY, 'auto', parseTheme));
  const [options, setOptions] = useState<Options>(() => load(OPTIONS_KEY, DEFAULT_OPTIONS, parseOptions));
  const [store, setStore] = useState<RecordStore>(() => load(RECORDS_KEY, EMPTY_STORE, parseStore));
  const [settings, setSettings] = useState<QuizSettings>(() => load(SETTINGS_KEY, DEFAULT_SETTINGS, parseSettings));
  const [run, setRun] = useState<QuizRun | null>(null);
  const [timeline] = useState(() => new Timeline());
  const dragging = useRef(false);

  const current = store.players.find((p) => p.id === store.currentId) ?? null;
  const question = mode === 'quiz' && run && !run.done ? run.questions[run.index] : null;
  const active = question ? question.situation : situation;
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
  useEffect(() => save(RECORDS_KEY, JSON.stringify(store)), [store]);
  useEffect(() => save(SETTINGS_KEY, JSON.stringify(settings)), [settings]);

  /* ── 퀴즈 진행 ── */

  const startRun = (questions: Question[], retry: boolean, s: QuizSettings = settings) => {
    if (!current || !questions.length) return;
    setRun({
      playerId: current.id,
      settings: s,
      retry,
      questions,
      index: 0,
      guess: null,
      revealed: false,
      answers: [],
      done: false,
      prevBest: playerStats(store, current.id)?.best ?? 0,
    });
    setFocus(null);
  };
  const startNew = () => startRun(makeRun(options, settings.count, settings.position), false);
  const retryWrong = () => {
    if (!run) return;
    const qs = run.answers.filter((a) => a.grade !== 'correct').map(({ situation: s, fielder }) => ({ situation: s, fielder }));
    startRun(qs, true, run.settings);
  };

  const finish = (r: QuizRun) => {
    if (r.answers.length) {
      setStore((st) =>
        addSession(st, {
          playerId: r.playerId,
          date: Date.now(),
          position: r.settings.position,
          difficulty: r.settings.difficulty,
          retry: r.retry,
          answers: r.answers,
        }),
      );
    }
  };

  const result = question && run?.guess ? grade(run.guess, plan.assignments[question.fielder].pos, run.settings.difficulty) : null;

  const reveal = () => {
    if (!run || !question || !result || run.revealed) return;
    const rec: AnswerRecord = { situation: question.situation, fielder: question.fielder, grade: result.grade, error: result.error };
    setRun({ ...run, revealed: true, answers: [...run.answers, rec] });
  };

  const next = () => {
    if (!run) return;
    if (run.index + 1 >= run.questions.length) {
      const done = { ...run, done: true };
      finish(done);
      setRun(done);
    } else {
      setRun({ ...run, index: run.index + 1, guess: null, revealed: false });
    }
    setFocus(null);
  };

  const quit = () => {
    if (run && !run.done) finish(run);
    setRun(null);
  };

  const review = (s: Situation) => {
    setSituation(s);
    setMode('learn');
    setFocus(null);
  };

  const changeMode = (m: Mode) => {
    setMode(m);
    setFocus(null);
  };

  /* ── 선수 ── */

  const selectPlayer = (id: string | null) => {
    setStore((st) => ({ ...st, currentId: id }));
    const pl = store.players.find((p) => p.id === id);
    if (pl) setSettings((s) => ({ ...s, position: pl.position }));
  };
  const register = (name: string) => setStore((st) => upsertPlayer(st, name, settings.position).store);
  const changeSettings = (s: QuizSettings) => {
    setSettings(s);
    if (current && s.position !== current.position) setStore((st) => setPlayerPosition(st, current.id, s.position));
  };

  /* ── 그라운드 입력 ── */

  const onFieldPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = toFieldPoint(e);
    if (!p) return;
    if (mode === 'quiz') {
      if (!run || !question || run.revealed) return;
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setRun({ ...run, guess: p });
      return;
    }
    const click = interpretClick(p);
    if (click) setSituation((s) => applyClick(s, click));
  };
  const onFieldPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!run || !question || !dragging.current || run.revealed) return;
    const p = toFieldPoint(e);
    if (p) setRun({ ...run, guess: p });
  };
  const onFieldPointerUp = () => {
    dragging.current = false;
  };

  const runTally = tally(run?.answers ?? []);
  const board = mode === 'quiz' && run?.done ? leaderboard(store) : [];
  const myRank = board.find((r) => r.player.id === run?.playerId)?.rank ?? null;
  const runPlayer = store.players.find((p) => p.id === run?.playerId);

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

      {mode === 'stats' ? (
        <Dashboard
          store={store}
          onSelect={(id) => setStore((st) => ({ ...st, currentId: id }))}
          onRemove={(id) => setStore((st) => removePlayer(st, id))}
          onStartQuiz={() => changeMode('quiz')}
          onReview={review}
        />
      ) : (
        <div className="layout">
          <section className="field-wrap" aria-label="그라운드">
            <Field onPointerDown={onFieldPointerDown} onPointerMove={onFieldPointerMove} onPointerUp={onFieldPointerUp}>
              <Play
                key={question ? `quiz-${run!.index}-${question.fielder}-${JSON.stringify(question.situation)}` : 'learn'}
                plan={plan}
                start={start}
                replayKey={replayKey}
                timeline={timeline}
                focus={focus}
                onFocus={setFocus}
                exclude={question ? question.fielder : null}
              />
              {question && run ? (
                <QuizLayer
                  number={POS_NUMBER[question.fielder]}
                  start={start[question.fielder]}
                  guess={run.guess}
                  answer={run.revealed ? plan.assignments[question.fielder].pos : null}
                  answerRole={plan.assignments[question.fielder].role}
                  grade={run.revealed && result ? result.grade : null}
                  error={run.revealed && result ? result.error : null}
                />
              ) : (
                mode === 'learn' && <Runners runners={situation.runners} />
              )}
            </Field>
            <PlaybackBar timeline={timeline} />
            <ul className="legend">
              {LEGEND.map((r) => (
                <li key={r} className={`role-${r}`}>
                  <span className="dot" />
                  {ROLE_NAME[r]}
                </li>
              ))}
            </ul>
            <p className="hint">
              {mode === 'quiz'
                ? question
                  ? '그라운드를 눌러 위치를 찍고 끌어서 조정하세요.'
                  : '오른쪽에서 선수·포지션·문항 수를 고르고 시작하세요.'
                : '그라운드를 누르면 타구 방향, 베이스를 누르면 주자 추가·제거. 내야(홈에서 135ft 이내)는 땅볼.'}
            </p>
          </section>

          <div className="panel">
            {mode === 'quiz' ? (
              !run ? (
                <QuizSetup
                  players={store.players}
                  current={current}
                  settings={settings}
                  onSettings={changeSettings}
                  onSelectPlayer={selectPlayer}
                  onRegister={register}
                  onStart={startNew}
                />
              ) : run.done ? (
                <QuizResult
                  playerName={runPlayer?.name ?? ''}
                  answers={run.answers}
                  tally={runTally}
                  retry={run.retry}
                  prevBest={run.prevBest}
                  rank={myRank}
                  players={board.length}
                  onRestart={() => startRun(makeRun(options, run.settings.count, run.settings.position), false, run.settings)}
                  onRetryWrong={retryWrong}
                  onSetup={() => setRun(null)}
                  onDashboard={() => {
                    setRun(null);
                    changeMode('stats');
                  }}
                  onReview={review}
                />
              ) : (
                question && (
                  <>
                    <QuizPanel
                      playerName={runPlayer?.name ?? ''}
                      fielder={question.fielder}
                      index={run.index}
                      count={run.questions.length}
                      difficulty={run.settings.difficulty}
                      retry={run.retry}
                      hasGuess={run.guess !== null}
                      revealed={run.revealed}
                      grade={result?.grade ?? null}
                      error={result?.error ?? null}
                      answer={plan.assignments[question.fielder]}
                      run={runTally}
                      onReveal={reveal}
                      onNext={next}
                      onQuit={quit}
                    />
                    {run.revealed && (
                      <>
                        <Summary plan={plan} />
                        <RoleCards plan={plan} focus={focus} onFocus={setFocus} />
                      </>
                    )}
                  </>
                )
              )
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
      )}
    </div>
  );
}
