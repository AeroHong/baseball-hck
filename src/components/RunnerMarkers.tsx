import { runnerSpot } from '../geometry';
import type { RunnerMove } from '../types';
import { sx, sy } from './Field';

export const runnerKey = (m: RunnerMove) => String(m.id);

interface RunnerMarkersProps {
  moves: RunnerMove[];
  registerRunner: (key: string, el: SVGGElement | null) => void;
  registerResult: (key: string, el: SVGGElement | null) => void;
}

/** 타자(B)·주자(R) 마커와 도착 지점의 결과 표시(✕ 아웃, ? 시도). 위치·투명도는 usePlayAnimation 이 갱신 */
export default function RunnerMarkers({ moves, registerRunner, registerResult }: RunnerMarkersProps) {
  return (
    <g className="runner-markers" aria-hidden="true">
      {moves.map((m) => {
        const k = runnerKey(m);
        const startP = runnerSpot(m.path[0]);
        const endP = runnerSpot(m.path[m.path.length - 1]);
        const batter = m.id === 'batter';
        return (
          <g key={k}>
            {(m.result === 'out' || m.result === 'attempt') && (
              <g
                ref={(el) => registerResult(k, el)}
                className={`runner-result ${m.result}`}
                transform={`translate(${sx(endP).toFixed(1)} ${(sy(endP) - 10).toFixed(1)})`}
                opacity={0}
              >
                <circle r={5} />
                <text dy="0.36em">{m.result === 'out' ? '✕' : '?'}</text>
              </g>
            )}
            <g
              ref={(el) => registerRunner(k, el)}
              className={batter ? 'runner batter' : 'runner'}
              transform={`translate(${sx(startP).toFixed(1)} ${sy(startP).toFixed(1)})`}
            >
              <circle r={5.5} />
              <text dy="0.35em">{batter ? 'B' : 'R'}</text>
            </g>
          </g>
        );
      })}
    </g>
  );
}
