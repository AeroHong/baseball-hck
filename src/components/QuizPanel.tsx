import type { Grade } from '../quiz';
import { CLOSE_FT, CORRECT_FT } from '../quiz';
import type { Assignment, PosKey } from '../types';
import { BASE_NAME, POS_NAME, POS_NUMBER, ROLE_NAME } from '../types';

export interface QuizScore {
  correct: number;
  close: number;
  wrong: number;
}

const GRADE_TEXT: Record<Grade, string> = { correct: '정답!', close: '근접', wrong: '오답' };

interface QuizPanelProps {
  fielder: PosKey;
  hasGuess: boolean;
  revealed: boolean;
  grade: Grade | null;
  error: number | null;
  answer: Assignment;
  session: QuizScore;
  total: QuizScore;
  onReveal: () => void;
  onNext: () => void;
}

export default function QuizPanel(p: QuizPanelProps) {
  const name = `${POS_NUMBER[p.fielder]}번 ${POS_NAME[p.fielder]}`;
  const totalCount = p.total.correct + p.total.close + p.total.wrong;
  return (
    <section className="quiz-panel" aria-labelledby="quiz-h">
      <h2 id="quiz-h">퀴즈</h2>
      <p className="quiz-question">
        이 상황에서 <b>{name}</b>는 어디로 가야 할까요?
      </p>
      {!p.revealed && (
        <p className="hint-inline">
          그라운드를 눌러 위치를 찍고, 끌어서 조정하세요. 점선 원이 시작 위치입니다. {CORRECT_FT}ft 이내 정답, {CLOSE_FT}ft 이내 근접.
        </p>
      )}

      {p.revealed && p.grade && (
        <div className={`quiz-result ${p.grade}`} role="status">
          <strong>{GRADE_TEXT[p.grade]}</strong> 오차 {Math.round(p.error ?? 0)}ft
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
            다음 문제 →
          </button>
        )}
      </div>

      <p className="quiz-score">
        이번 세션: 정답 {p.session.correct} · 근접 {p.session.close} · 오답 {p.session.wrong}
        {totalCount > 0 && (
          <>
            <br />
            누적 {totalCount}문제 · 정답률 {Math.round((p.total.correct / totalCount) * 100)}%
          </>
        )}
      </p>
    </section>
  );
}
