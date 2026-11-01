import { B1, B2, B3, along, dist } from '../geometry';
import type { Point, Runners as RunnersState } from '../types';
import { sx, sy } from './Field';

const CENTER: Point = { x: 0, y: 63.6 };
/** 커버 수비수와 겹치지 않게 베이스 바깥쪽으로 조금 비켜 표시 */
const spot = (b: Point) => along(CENTER, b, dist(CENTER, b) + 11);

export default function Runners({ runners }: { runners: RunnersState }) {
  const bases = [
    [1, B1],
    [2, B2],
    [3, B3],
  ] as const;
  return (
    <g className="runners" aria-hidden="true">
      {bases.map(([b, p]) => (
        <g key={b} className={`base-hit${runners[b] ? ' on' : ''}`}>
          {/* 클릭 영역 힌트 (호버 시 표시) */}
          <circle className="base-target" cx={sx(p)} cy={sy(p)} r={12} />
          {runners[b] && (
            <g transform={`translate(${sx(spot(p)).toFixed(1)} ${sy(spot(p)).toFixed(1)})`}>
              <circle className="runner" r={5.5} />
              <text className="runner-text" dy="0.35em">
                R
              </text>
            </g>
          )}
        </g>
      ))}
    </g>
  );
}
