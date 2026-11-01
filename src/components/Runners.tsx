import { B1, B2, B3 } from '../geometry';
import type { Runners as RunnersState } from '../types';
import { sx, sy } from './Field';

/** 베이스 클릭 영역 (호버 시 점선 원). 주자 마커는 RunnerMarkers 가 애니메이션과 함께 그린다 */
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
        </g>
      ))}
    </g>
  );
}
