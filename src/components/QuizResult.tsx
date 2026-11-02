import type { Grade } from '../quiz';
import type { AnswerRecord, Tally } from '../records';
import { correctRate, scoreRate } from '../records';
import { situationTitle } from '../rules';
import type { Situation } from '../types';
import { POS_NAME, POS_NUMBER } from '../types';

const MARK: Record<Grade, string> = { correct: '○', close: '△', wrong: '✕' };

interface QuizResultProps {
  playerName: string;
  answers: AnswerRecord[];
  tally: Tally;
  retry: boolean;
  /** 이 판 전 최고 점수율 (신기록 표시용) */
  prevBest: number;
  rank: number | null;
  players: number;
  onRestart: () => void;
  onRetryWrong: () => void;
  onSetup: () => void;
  onDashboard: () => void;
  onReview: (s: Situation) => void;
}

export default function QuizResult(p: QuizResultProps) {
  const rate = scoreRate(p.tally);
  const misses = p.answers.filter((a) => a.grade !== 'correct').length;
  const record = !p.retry && rate > p.prevBest && p.prevBest > 0;
  return (
    <section className="quiz-result-panel" aria-labelledby="result-h">
      <h2 id="result-h">{p.retry ? '오답 다시 풀기 결과' : '결과'}</h2>
      <div className="result-hero">
        <div className="result-score">
          <strong>{p.tally.points}</strong>
          <span>/ {p.tally.n * 10}점</span>
        </div>
        <div className="result-meta">
          <div>
            {p.playerName} · 점수율 <b>{rate}%</b> · 정답률 {correctRate(p.tally)}%
          </div>
          <div>
            정답 {p.tally.correct} · 근접 {p.tally.close} · 오답 {p.tally.wrong}
          </div>
          {record && <div className="badge-record">개인 최고 기록!</div>}
          {!p.retry && p.rank && (
            <div className="muted">
              순위표 {p.rank}위 / {p.players}명
            </div>
          )}
          {p.retry && <div className="muted">오답 다시 풀기는 순위에 반영되지 않습니다.</div>}
        </div>
      </div>

      <ol className="answer-list">
        {p.answers.map((a, i) => (
          <li key={i} className={a.grade}>
            <span className="mark" aria-label={a.grade}>
              {MARK[a.grade]}
            </span>
            <span className="answer-desc">
              <b>
                {POS_NUMBER[a.fielder]} {POS_NAME[a.fielder]}
              </b>{' '}
              <small>
                {situationTitle(a.situation)} · {Math.round(a.error)}ft
              </small>
            </span>
            <button type="button" className="link" onClick={() => p.onReview(a.situation)}>
              학습에서 보기
            </button>
          </li>
        ))}
      </ol>

      <div className="quiz-actions wrap">
        <button type="button" className="primary" onClick={p.onRestart}>
          같은 설정으로 다시
        </button>
        {misses > 0 && (
          <button type="button" onClick={p.onRetryWrong}>
            틀린 {misses}문제 다시 풀기
          </button>
        )}
        <button type="button" onClick={p.onSetup}>
          설정 바꾸기
        </button>
        <button type="button" onClick={p.onDashboard}>
          기록 보기
        </button>
      </div>
    </section>
  );
}
