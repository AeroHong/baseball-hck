import type { Difficulty, Grade } from '../quiz';
import { DIFFICULTY_NAME, POINTS, THRESHOLDS } from '../quiz';
import type { Tally } from '../records';
import type { Assignment, PosKey } from '../types';
import { BASE_NAME, POS_NAME, POS_NUMBER, ROLE_NAME } from '../types';

const GRADE_TEXT: Record<Grade, string> = { correct: '정답!', close: '근접', wrong: '오답' };

interface QuizPanelProps {
  playerName: string;
  fielder: PosKey;
  index: number;
  count: number;
  difficulty: Difficulty;
  retry: boolean;
  hasGuess: boolean;
  revealed: boolean;
  grade: Grade | null;
  error: number | null;
  answer: Assignment;
  run: Tally;
  onReveal: () => void;
  onNext: () => void;
  onQuit: () => void;
}

export default function QuizPanel(p: QuizPanelProps) {
  const name = `${POS_NUMBER[p.fielder]}번 ${POS_NAME[p.fielder]}`;
  const t = THRESHOLDS[p.difficulty];
  const last = p.index + 1 >= p.count;
  return (
    <section className="quiz-panel" aria-labelledby="quiz-h">
      <div className="quiz-head">
        <h2 id="quiz-h">
          {p.retry ? '오답 다시 풀기' : '퀴즈'} <span className="quiz-progress">{p.index + 1} / {p.count}</span>
        </h2>
        <span className="quiz-meta">
          {p.playerName} · {DIFFICULTY_NAME[p.difficulty]} · {p.run.points}점
        </span>
      </div>
      <div className="progress-bar" aria-hidden="true">
        <span style={{ width: `${((p.index + (p.revealed ? 1 : 0)) / p.count) * 100}%` }} />
      </div>

      <p className="quiz-question">
        이 상황에서 <b>{name}</b>는 어디로 가야 할까요?
      </p>
      {p.difficulty === 'easy' && !p.revealed && (
        <p className="quiz-hint">
          힌트: {ROLE_NAME[p.answer.role]}
          {p.answer.base ? ` — ${BASE_NAME[p.answer.base]}` : ''}
        </p>
      )}
      {!p.revealed && (
        <p className="hint-inline">
          그라운드를 눌러 위치를 찍고, 끌어서 조정하세요. 점선 원이 시작 위치입니다. {t.correct}ft 이내 정답, {t.close}ft 이내 근접.
        </p>
      )}

      {p.revealed && p.grade && (
        <div className={`quiz-result ${p.grade}`} role="status">
          <strong>{GRADE_TEXT[p.grade]}</strong> 오차 {Math.round(p.error ?? 0)}ft · +{POINTS[p.grade]}점
          <div className="quiz-answer-text">
            정답: {ROLE_NAME[p.answer.role]}
            {p.answer.base ? ` (${BASE_NAME[p.answer.base]})` : ''} — {p.answer.text}
          </div>
        </div>
      )}

      <div className="quiz-actions">
        {!p.revealed ? (
          <button type="button" className="primary" disabled={!p.hasGuess} onClick={p.onReveal}>
            정답 확인
          </button>
        ) : (
          <button type="button" className="primary" onClick={p.onNext}>
            {last ? '결과 보기 →' : '다음 문제 →'}
          </button>
        )}
        <button type="button" className="ghost" onClick={p.onQuit}>
          그만하기
        </button>
      </div>

      <p className="quiz-score">
        이번 판: 정답 {p.run.correct} · 근접 {p.run.close} · 오답 {p.run.wrong}
      </p>
    </section>
  );
}
