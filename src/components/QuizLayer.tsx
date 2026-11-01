import { lerp } from '../geometry';
import type { Grade } from '../quiz';
import type { Point, Role } from '../types';
import { sx, sy } from './Field';

interface QuizLayerProps {
  number: number;
  start: Point;
  guess: Point | null;
  answer: Point | null; // 정답 공개 전에는 null
  answerRole: Role;
  grade: Grade | null;
  error: number | null;
}

/** 퀴즈: 시작 위치(점선) · 내가 찍은 위치 · 정답 위치와 오차 */
export default function QuizLayer({ number, start, guess, answer, answerRole, grade, error }: QuizLayerProps) {
  const mid = guess && answer ? lerp(guess, answer, 0.5) : null;
  return (
    <g className="quiz-layer">
      <g transform={`translate(${sx(start)} ${sy(start)})`} className="quiz-ghost">
        <circle r={9} />
        <text dy="0.35em">{number}</text>
      </g>

      {guess && answer && <line className={`quiz-error ${grade}`} x1={sx(guess)} y1={sy(guess)} x2={sx(answer)} y2={sy(answer)} />}

      {answer && (
        <g transform={`translate(${sx(answer)} ${sy(answer)})`} className={`quiz-answer fielder role-${answerRole}`}>
          <circle r={9} />
          <text dy="0.35em">{number}</text>
        </g>
      )}

      {guess && (
        <g transform={`translate(${sx(guess)} ${sy(guess)})`} className={`quiz-guess${grade ? ` ${grade}` : ''}`}>
          <circle r={10} />
          <text dy="0.35em">{answer ? number : '?'}</text>
        </g>
      )}

      {mid && error !== null && (
        <text className="quiz-error-label" x={sx(mid) + 6} y={sy(mid) - 6}>
          {Math.round(error)}ft
        </text>
      )}
    </g>
  );
}
